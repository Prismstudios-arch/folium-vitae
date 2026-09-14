/**
 * RevenueCat webhooks.
 *
 * A plan only ever changes to match RevenueCat's own records — through these
 * webhooks, or a sync that reads the same records (routes/subscriptions.ts).
 * The app never tells the server what it has bought: premium decided by a
 * client boolean is premium anyone can grant themselves (SPEC §6).
 */

import { Router, Request, Response } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { query } from "../db";
import * as Users from "../models/User";
import {
  ENTITLEMENT_TO_PLAN,
  fetchPlan,
  isRevenueCatConfigured,
} from "../services/entitlements";
import logger from "../utils/logger";

export const webhookRoutes = Router();

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
  /** TRANSFER only. */
  transferred_from?: string[];
  transferred_to?: string[];
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Look up a user by the id RevenueCat sends.
 *
 * RevenueCat can send ids that aren't ours — its own "$RCAnonymousID:…" ones,
 * for a start. users.id is a UUID column, and Postgres rejects anything else
 * with an error rather than "no rows", which surfaced as a 500 and made
 * RevenueCat retry the event forever.
 */
async function findKnownUser(id: string): Promise<Users.UserRow | null> {
  return UUID_PATTERN.test(id) ? Users.findById(id) : null;
}

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
    //
    // Trimmed on both sides: a trailing newline pasted into a dashboard env
    // var is invisible and rejects every delivery, which presents as
    // purchases silently never granting access.
    const provided = (req.headers.authorization ?? "").trim();

    if (provided !== expected.trim()) {
      // Length is safe to log and is usually enough to spot a truncated
      // paste or an extra character. The values themselves are not logged.
      logger.warn(
        `Rejected RevenueCat webhook: authorization mismatch ` +
          `(received ${provided.length} chars, expected ${expected.trim().length})`
      );
      throw ApiError.unauthorized("Invalid webhook signature");
    }

    const event = (req.body as { event?: RevenueCatEvent })?.event;

    if (!event?.type) {
      throw ApiError.badRequest("Missing event");
    }

    // TRANSFER has no app_user_id, so the check below used to reject it with
    // a 400 — RevenueCat retried it indefinitely, and someone who restored
    // their purchase after reinstalling stayed on the free plan.
    if (event.type === "TRANSFER") {
      const applied = await applyTransfer(event);
      return res.json({ received: true, applied });
    }

    const userId = event.app_user_id ?? event.original_app_user_id;

    if (!userId) {
      throw ApiError.badRequest("Missing app_user_id");
    }

    const user = await findKnownUser(userId);

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
      // BILLING_ISSUE, CANCELLATION and the rest are recorded but do not
      // move the plan.
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

/**
 * Re-read the plan for every account a transfer touched.
 *
 * Needs the RevenueCat secret key: the event itself says nothing about which
 * entitlements moved. Without the key the transfer is acknowledged and
 * logged loudly, not guessed at. If RevenueCat can't be reached, fetchPlan
 * throws and the 500 makes RevenueCat retry — which is right for a
 * temporary failure.
 */
async function applyTransfer(event: RevenueCatEvent): Promise<boolean> {
  const ids = Array.from(new Set([...(event.transferred_to ?? []), ...(event.transferred_from ?? [])]));

  if (!isRevenueCatConfigured()) {
    logger.warn(
      `RevenueCat TRANSFER involving ${ids.join(", ")} was not applied: ` +
        `REVENUECAT_API_KEY is not set, so the moved entitlements can't be read`
    );
    return false;
  }

  let applied = false;

  for (const id of ids) {
    const user = await findKnownUser(id);
    if (!user) continue;

    const plan = await fetchPlan(id);

    if (plan !== user.plan) {
      await Users.setPlan(id, plan);
      logger.info(`RevenueCat TRANSFER: ${id} ${user.plan} -> ${plan}`);
    }

    await recordSubscription(id, event, plan);
    applied = true;
  }

  return applied;
}

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
