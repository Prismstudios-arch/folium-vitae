/**
 * POST /api/identify — the identification proxy.
 *
 * The app never talks to the vision provider directly. Routing through here
 * is what keeps the API key off the device, enforces quota somewhere the
 * client cannot edit, and lets a repeated photo be answered from cache
 * instead of paying for it again (SPEC 6).
 */

import { Router, Request, Response } from "express";
import { asyncHandler, VerdureError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { query, queryOne } from "../db";
import * as Users from "../models/User";
import { identify as callProvider, isProviderConfigured, IdentificationResult } from "../services/identifyProvider";
import logger from "../utils/logger";

export const identifyRoutes = Router();

identifyRoutes.use(requireAuth);

/** ~8MB of base64 across all images. Anything larger is a client bug. */
const MAX_TOTAL_BASE64 = 8 * 1024 * 1024;
const MAX_IMAGES = 5;

interface IncomingImage {
  base64?: string;
  organ?: string;
}

function parseImages(body: unknown): { base64: string[]; organs: string[] } {
  const images = (body as { images?: IncomingImage[] })?.images;

  if (!Array.isArray(images) || images.length === 0) {
    throw VerdureError.badRequest("Send at least one image");
  }

  if (images.length > MAX_IMAGES) {
    throw VerdureError.badRequest(`Send at most ${MAX_IMAGES} images`);
  }

  const base64: string[] = [];
  const organs: string[] = [];
  let total = 0;

  for (const image of images) {
    if (typeof image?.base64 !== "string" || image.base64.length === 0) {
      throw VerdureError.badRequest("Each image needs base64 data");
    }

    // Accept a data: URI or a bare payload; the provider wants the latter.
    const payload = image.base64.includes(",")
      ? image.base64.slice(image.base64.indexOf(",") + 1)
      : image.base64;

    total += payload.length;

    if (total > MAX_TOTAL_BASE64) {
      throw VerdureError.badRequest("Those photos are too large. Try fewer, or smaller.");
    }

    base64.push(payload);
    if (image.organ) organs.push(image.organ);
  }

  return { base64, organs };
}

identifyRoutes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.sub;
    const imageHash = (req.body as { imageHash?: unknown })?.imageHash;

    if (typeof imageHash !== "string" || imageHash.length < 8) {
      throw VerdureError.badRequest("An image hash is required");
    }

    if (!isProviderConfigured()) {
      // Explicitly not a mock fallback. An unconfigured server says so.
      throw VerdureError.serviceUnavailable(
        "Plant identification is not configured on this server yet."
      );
    }

    const { base64, organs } = parseImages(req.body);

    // --- Cache ---------------------------------------------------------
    // A repeat of a photo we have already paid for costs nothing and does
    // not spend a credit. Charging twice for the same picture would be
    // indefensible.
    const cached = await queryOne<{ result: IdentificationResult }>(
      `UPDATE identification_cache
          SET hit_count = hit_count + 1, last_hit_at = now()
        WHERE image_hash = $1
        RETURNING result`,
      [imageHash]
    );

    if (cached) {
      logger.info(`Identify cache hit for ${userId}`);
      return res.json({ ...cached.result, cached: true });
    }

    // --- Quota ---------------------------------------------------------
    const quota = await Users.getQuota(userId);

    if (quota.remaining <= 0) {
      throw VerdureError.tooManyRequests(
        `Daily limit reached. Your ${quota.limit} scans reset at midnight.`
      );
    }

    // --- Provider ------------------------------------------------------
    // Deliberately before consuming: a failed identification must not cost
    // the user a credit (SPEC 5).
    const result = await callProvider(base64, organs);

    const consumed = await Users.consumeQuota(userId);

    if (!consumed) {
      // Raced to the cap between the check and the claim. We have already
      // paid the provider and the user has an answer, so return it rather
      // than withholding work they effectively earned.
      logger.warn(`Quota race for ${userId}; returning result anyway`);
    }

    // --- Persist -------------------------------------------------------
    // Cache and history are best-effort. Losing them must not fail a
    // request the user has already waited for.
    const top = result.candidates[0];

    try {
      await query(
        `INSERT INTO identification_cache (image_hash, provider, result)
         VALUES ($1, $2, $3)
         ON CONFLICT (image_hash) DO NOTHING`,
        [imageHash, result.provider, JSON.stringify(result)]
      );

      await query(
        `INSERT INTO identifications
           (user_id, image_hash, top_candidate_scientific_name, raw_score, candidates)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, imageHash, top.scientificName, top.rawScore, JSON.stringify(result.candidates)]
      );
    } catch (error) {
      logger.error("Failed to record identification:", error);
    }

    res.json({
      ...result,
      cached: false,
      quota: consumed ?? (await Users.getQuota(userId)),
    });
  })
);

/**
 * GET /api/identify/history
 */
identifyRoutes.get(
  "/history",
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await query(
      `SELECT id, image_hash, top_candidate_scientific_name, raw_score,
              candidates, identified_at
         FROM identifications
        WHERE user_id = $1
        ORDER BY identified_at DESC
        LIMIT 50`,
      [req.auth!.sub]
    );

    res.json({ identifications: rows });
  })
);
