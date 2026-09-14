/**
 * Quota routes.
 *
 * The count lives server-side because a client-side counter is defeated by
 * reinstalling the app or moving the device clock (SPEC 6).
 *
 * There is deliberately no endpoint here that lets a client set its own plan.
 * Entitlements arrive from RevenueCat webhooks, so premium is never decided
 * by a boolean the caller controls.
 */

import { Router, Request, Response } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth, requireSelf } from "../middleware/requireAuth";
import * as Users from "../models/User";
import { PLAN_QUOTAS } from "../models/User";

export const quotaRoutes = Router();

quotaRoutes.use(requireAuth);

/**
 * GET /api/quota/:userId
 */
quotaRoutes.get(
  "/:userId",
  requireSelf,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await Users.getQuota(req.params.userId));
  })
);

/**
 * POST /api/quota/:userId/consume
 *
 * Claims one credit. Returns 429 when the caller is at their cap, with the
 * reset time, because "you're out" without "until when" is the behaviour the
 * product is positioned against (SPEC 9).
 */
quotaRoutes.post(
  "/:userId/consume",
  requireSelf,
  asyncHandler(async (req: Request, res: Response) => {
    const state = await Users.consumeQuota(req.params.userId);

    if (!state) {
      const current = await Users.getQuota(req.params.userId);

      throw ApiError.tooManyRequests(
        `You've used all ${current.limit} of today's identifications. They reset at 00:00 UTC.`,
        "DAILY_LIMIT"
      );
    }

    res.json(state);
  })
);

/**
 * GET /api/quota/:userId/plans
 * What each tier allows, so the paywall renders real numbers.
 */
quotaRoutes.get(
  "/:userId/plans",
  requireSelf,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      plans: [
        { id: "free", name: "Free", scansPerDay: PLAN_QUOTAS.free },
        { id: "pro", name: "Pro", scansPerDay: PLAN_QUOTAS.pro },
        { id: "premium", name: "Premium", scansPerDay: null }, // null = unlimited
      ],
    });
  })
);
