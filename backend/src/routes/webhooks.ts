/**
 * RevenueCat webhooks.
 *
 * This is the only thing that may change a user's plan. The app never tells
 * the server what it has bought — premium decided by a client boolean is
 * premium anyone can grant themselves (SPEC §6).
 */

import { Router, Request, Response } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { query } from "../db";
import * as Users from "../models/User";
import logger from "../utils/logger";

export const webhookRoutes = Router();

/** Entitlement ids configured in RevenueCat, most privileged first. */
const ENTITLEMENT_TO_PLAN: Array<[string, Users.Plan]> = [
  ["premium", "premium"],
  ["pro", "pro"],
];

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  product_id?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  period_type?: string;
  cancel_reason?: string;
}

/**
 * Events that end access.
 *
 * CANCELLATION is deliberately absent. It means auto-renew was switched off,
 * not that access stopped — the user keeps what they paid for until
 * EXPIRATION. Downgrading on cancellation would cut short a period they are
 * still entitled to, which is precisely the kind of thing this product is
 * positioned against.
 */
const REVOKING_EVENTS = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

const GRANTING_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);

function planFor(entitlements: string[] | null | undefined): Users.Plan {
  if (!entitlements?.length) return "free";

  for (const [entitlement, plan] of ENTITLEMENT_TO_PLAN) {
    if (entitlements.includes(entitlement)) return plan;
  }

  return "free";
}

/**
 * POST /api/webhooks/revenuecat
 */
webhookRoutes.post(
  "/revenuecat",
  asyncHandler(async (req: Request, res: Response) => {
    const expected = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (!expected) {
      logger.error("REVENUECAT_WEBHOOK_SECRET is not set; refusing webhook");
      throw ApiError.serviceUnavailable("Webhooks are not configured.");
    }

    // RevenueCat sends whatever Authorization value you configure. Without
    // this check, anyone who finds the URL can grant themselves premium.
    if (req.headers.authorization !== expected) {
      logger.warn("Rejected RevenueCat webhook with bad authorization");
      throw ApiError.unauthorized("Invalid webhook signature");
    }

    const event = (req.body as { event?: RevenueCatEvent })?.event;

    if (!event?.type) {
      throw ApiError.badRequest("Missing event");
    }

    const userId = event.app_user_id ?? event.original_app_user_id;

    if (!userId) {
      throw ApiError.badRequest("Missing app_user_id");
    }

    const user = await Users.findById(userId);

    if (!user) {
      // Acknowledge anyway. Returning an error makes RevenueCat retry
      // forever for a user who genuinely does not exist here.
      logger.warn(`RevenueCat event ${event.type} for unknown user ${userId}`);
      return res.json({ received: true, applied: false });
    }

    let plan: Users.Plan | null = null;

    if (GRANTING_EVENTS.has(event.type)) {
      plan = planFor(event.entitlement_ids);
    } else if (REVOKING_EVENTS.has(event.type)) {
      plan = "free";
    }

    if (plan === null) {
      // BILLING_ISSUE, CANCELLATION, TRANSFER and the rest are recorded but
      // do not move the plan.
      logger.info(`RevenueCat ${event.type} for ${userId} (no plan change)`);
      await recordSubscription(userId, event, user.plan);
      return res.json({ received: true, applied: false });
    }

    await Users.setPlan(userId, plan);
    await recordSubscription(userId, event, plan);

    logger.info(`RevenueCat ${event.type}: ${userId} -> ${plan}`);

    res.json({ received: true, applied: true, plan });
  })
);

/** Keep an audit trail of what the store told us and when. */
async function recordSubscription(
  userId: string,
  event: RevenueCatEvent,
  plan: Users.Plan
): Promise<void> {
  try {
    await query(
      `INSERT INTO subscriptions
         (user_id, revenuecat_subscription_id, plan, status,
          current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         revenuecat_subscription_id = EXCLUDED.revenuecat_subscription_id,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        event.product_id ?? null,
        plan,
        plan === "free" ? "expired" : "active",
        event.purchased_at_ms ? new Date(event.purchased_at_ms) : null,
        event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
      ]
    );
  } catch (error) {
    // The plan change already succeeded; losing the audit row must not make
    // RevenueCat retry and re-apply it.
    logger.error("Failed to record subscription:", error);
  }
}
