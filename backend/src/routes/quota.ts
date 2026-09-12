/**
 * Quota API
 * Phase 2: Server-side quota tracking
 * Lifts Phase 1's 7 scans/day limit
 */

import { Router, Request, Response } from "express";
import logger from "../utils/logger";

export const quotaRoutes = Router();

interface QuotaInfo {
  userId: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  planType: "free" | "pro" | "premium";
}

const PLAN_LIMITS = {
  free: 7,        // Phase 1 limit
  pro: 50,        // $4.99/month
  premium: 1000,  // $9.99/month
};

/**
 * GET /api/quota/:userId
 * Get current quota information
 */
quotaRoutes.get("/:userId", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // TODO: Load from database with plan info
    const planType: "free" | "pro" | "premium" = "free";
    const limit = PLAN_LIMITS[planType];

    // TODO: Load actual used count for today
    const used = 0;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const quota: QuotaInfo = {
      userId,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt: tomorrow.toISOString(),
      planType,
    };

    res.json(quota);
  } catch (error) {
    logger.error("Failed to get quota:", error);
    res.status(500).json({ error: "Failed to get quota" });
  }
});

/**
 * POST /api/quota/:userId/consume
 * Consume one scan credit
 */
quotaRoutes.post("/:userId/consume", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // TODO: Verify user hasn't hit daily limit
    // TODO: Increment usage counter in database
    // TODO: Log for analytics

    logger.info(`Quota consumed for user ${userId}`);

    res.json({
      success: true,
      message: "Scan credit consumed",
    });
  } catch (error) {
    logger.error("Failed to consume quota:", error);
    res.status(500).json({ error: "Failed to consume quota" });
  }
});

/**
 * POST /api/quota/:userId/upgrade
 * Upgrade user plan
 */
quotaRoutes.post("/:userId/upgrade", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { planType, paymentMethodId } = req.body;

    // TODO: Validate plan type
    // TODO: Process payment (Stripe)
    // TODO: Update user plan in database
    // TODO: Send confirmation email

    logger.info(`User ${userId} upgraded to ${planType} plan`);

    res.json({
      success: true,
      plan: planType,
      message: "Plan upgraded successfully",
    });
  } catch (error) {
    logger.error("Failed to upgrade plan:", error);
    res.status(500).json({ error: "Failed to upgrade plan" });
  }
});

/**
 * GET /api/quota/pricing
 * Get available plans and pricing
 */
quotaRoutes.get("/", (req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: "free",
        name: "Free",
        price: 0,
        currency: "USD",
        interval: null,
        scansPerDay: 7,
        features: [
          "7 scans per day",
          "Basic plant database",
          "Care guides",
          "My Plants collection",
          "Ads included",
        ],
      },
      {
        id: "pro",
        name: "Pro",
        price: 4.99,
        currency: "USD",
        interval: "month",
        scansPerDay: 50,
        features: [
          "50 scans per day",
          "All basic features",
          "Disease detection",
          "No ads",
          "Email support",
        ],
      },
      {
        id: "premium",
        name: "Premium",
        price: 9.99,
        currency: "USD",
        interval: "month",
        scansPerDay: null,
        features: [
          "Unlimited scans",
          "All Pro features",
          "Expert escalation",
          "Priority support",
          "Early access to new features",
        ],
      },
    ];

    res.json({ plans });
  } catch (error) {
    logger.error("Failed to get pricing:", error);
    res.status(500).json({ error: "Failed to get pricing" });
  }
});
