/**
 * POST /api/diagnose — plant health assessment.
 *
 * Premium only. SPEC §6 lists "the free tier not including the expensive
 * disease endpoint" as one of the mitigations that keep unit economics
 * viable: health assessment is a separate, dearer provider call, and at 7
 * free scans a day it would not survive being given away.
 */

import { Router, Request, Response } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { query, queryOne } from "../db";
import * as Users from "../models/User";
import { assessHealth, isProviderConfigured, HealthAssessment } from "../services/identifyProvider";
import logger from "../utils/logger";

export const diagnoseRoutes = Router();

diagnoseRoutes.use(requireAuth);

const MAX_TOTAL_BASE64 = 8 * 1024 * 1024;
const MAX_IMAGES = 3;

function parseImages(body: unknown): string[] {
  const images = (body as { images?: Array<{ base64?: string }> })?.images;

  if (!Array.isArray(images) || images.length === 0) {
    throw ApiError.badRequest("Send at least one photo of the affected part");
  }

  if (images.length > MAX_IMAGES) {
    throw ApiError.badRequest(`Send at most ${MAX_IMAGES} photos`);
  }

  const encoded: string[] = [];
  let total = 0;

  for (const image of images) {
    if (typeof image?.base64 !== "string" || !image.base64) {
      throw ApiError.badRequest("Each photo needs image data");
    }

    const payload = image.base64.includes(",")
      ? image.base64.slice(image.base64.indexOf(",") + 1)
      : image.base64;

    total += payload.length;
    if (total > MAX_TOTAL_BASE64) {
      throw ApiError.badRequest("Those photos are too large. Try fewer, or smaller.");
    }

    encoded.push(payload);
  }

  return encoded;
}

diagnoseRoutes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.sub;
    const { imageHash, plantId } = (req.body ?? {}) as {
      imageHash?: unknown;
      plantId?: unknown;
    };

    if (typeof imageHash !== "string" || imageHash.length < 8) {
      throw ApiError.badRequest("An image hash is required");
    }

    if (!isProviderConfigured()) {
      throw ApiError.serviceUnavailable("Health checks are not configured on this server yet.");
    }

    // Read the plan from the database, never from the token — a token issued
    // before an upgrade or downgrade would otherwise decide access.
    const user = await Users.findById(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (user.plan === "free") {
      throw ApiError.forbidden(
        "Health checks are part of Premium. Your daily identifications are unaffected."
      );
    }

    // A repeated photo is answered from cache, at no provider cost. Someone
    // re-checking the same leaf should not pay for it twice.
    const cached = await queryOne<{ result: HealthAssessment }>(
      `UPDATE identification_cache
          SET hit_count = hit_count + 1, last_hit_at = now()
        WHERE image_hash = $1
        RETURNING result`,
      [`health:${imageHash}`]
    );

    if (cached) {
      return res.json({ ...cached.result, cached: true });
    }

    const assessment = await assessHealth(parseImages(req.body));

    // Best effort. Losing the record must not fail a request the user has
    // already waited for.
    try {
      await query(
        `INSERT INTO identification_cache (image_hash, provider, result)
         VALUES ($1, $2, $3)
         ON CONFLICT (image_hash) DO NOTHING`,
        [`health:${imageHash}`, assessment.provider, JSON.stringify(assessment)]
      );

      if (typeof plantId === "string" && plantId) {
        await query(
          `INSERT INTO diagnoses
             (plant_id, is_healthy, confidence, diseases, detected_at)
           VALUES ($1, $2, $3, $4, now())`,
          [
            plantId,
            assessment.isHealthy,
            assessment.healthyProbability,
            assessment.diseases.map((d) => d.name),
          ]
        );
      }
    } catch (error) {
      logger.error("Failed to record diagnosis:", error);
    }

    res.json({ ...assessment, cached: false });
  })
);
