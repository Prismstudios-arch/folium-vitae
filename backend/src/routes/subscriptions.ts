/**
 * Subscription sync.
 *
 * The app calls this straight after a purchase or restore. The server then
 * reads the caller's entitlements from RevenueCat itself and applies them —
 * the request carries no claim about what was bought, so there is nothing
 * in it for a client to forge.
 */

import { Router, Request, Response } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { fetchPlan, isRevenueCatConfigured } from "../services/entitlements";
import * as Users from "../models/User";
import logger from "../utils/logger";

export const subscriptionRoutes = Router();

subscriptionRoutes.use(requireAuth);

/**
 * POST /api/subscriptions/sync
 */
subscriptionRoutes.post(
  "/sync",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isRevenueCatConfigured()) {
      throw ApiError.serviceUnavailable(
        "Subscription sync isn't set up on this server. Purchases still apply through RevenueCat's webhook."
      );
    }

    const userId = req.auth!.sub;
    const user = await Users.findById(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    let plan: Users.Plan;

    try {
      plan = await fetchPlan(userId);
    } catch (error) {
      logger.error("RevenueCat lookup failed during sync:", error);
      throw ApiError.serviceUnavailable(
        "Couldn't check your subscription just now. Your purchase is safe and will apply shortly."
      );
    }

    if (plan !== user.plan) {
      await Users.setPlan(userId, plan);
      logger.info(`Subscription sync: ${userId} ${user.plan} -> ${plan}`);
    }

    res.json({ plan });
  })
);
