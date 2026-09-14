/**
 * Reading a user's plan straight from RevenueCat.
 *
 * Webhooks remain the main path. This covers the two cases they handle
 * badly:
 *
 *  - The gap between paying and the webhook arriving, when a new subscriber
 *    would otherwise open a Premium feature and be told it's locked.
 *  - TRANSFER events. RevenueCat sends one when purchases are restored onto
 *    a different account — which is what happens after a reinstall, because a
 *    fresh install signs in as a new anonymous user. The event names the
 *    accounts but carries no entitlements, so the only way to know the right
 *    plan is to ask.
 *
 * The secret key is used here, server-side, and nowhere else. The app can
 * ask for a sync but never says what it bought (SPEC §6).
 */

import axios from "axios";
import type { Plan } from "../models/User";

/** Entitlement ids configured in RevenueCat, most privileged first. */
export const ENTITLEMENT_TO_PLAN: Array<[string, Plan]> = [
  ["premium", "premium"],
  ["pro", "pro"],
];

export function isRevenueCatConfigured(): boolean {
  return Boolean(process.env.REVENUECAT_API_KEY);
}

interface SubscriberEntitlement {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
}

/**
 * The plan an entitlement map grants right now.
 *
 * A null expiry is a lifetime purchase. A billing grace period counts as
 * active — Apple is still retrying the card, and cutting access on the first
 * failure punishes someone whose payment may well go through.
 */
export function planFromEntitlements(
  entitlements: Record<string, SubscriberEntitlement> | undefined | null,
  now: Date = new Date()
): Plan {
  if (!entitlements) return "free";

  for (const [entitlementId, plan] of ENTITLEMENT_TO_PLAN) {
    const entitlement = entitlements[entitlementId];
    if (!entitlement) continue;

    if (entitlement.expires_date === null) return plan;

    const stillActive = [entitlement.expires_date, entitlement.grace_period_expires_date].some(
      (value) => {
        const time = value ? Date.parse(value) : NaN;
        return Number.isFinite(time) && time > now.getTime();
      }
    );

    if (stillActive) return plan;
  }

  return "free";
}

/**
 * Ask RevenueCat what this user is entitled to.
 *
 * Throws when RevenueCat can't be reached rather than answering "free". A
 * guess on failure would downgrade a paying subscriber over a network blip.
 */
export async function fetchPlan(appUserId: string): Promise<Plan> {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) throw new Error("REVENUECAT_API_KEY is not set");

  const { data } = await axios.get(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 10_000,
    }
  );

  return planFromEntitlements(data?.subscriber?.entitlements);
}
