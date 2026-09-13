/**
 * Subscriptions, via RevenueCat.
 *
 * Two rules shape this file.
 *
 * Prices are never hardcoded. They come from the store, already localised and
 * formatted, because the number shown has to be the number charged — anything
 * else is both wrong and an App Store guideline violation.
 *
 * Entitlements are never decided here. The client reports what it sees, but
 * the plan on the server is set by RevenueCat's webhook, so premium is not a
 * boolean a client can flip (SPEC §6).
 */

import { Platform } from "react-native";
import { REVENUECAT_PUBLIC_KEY } from "@constants/config";

// RevenueCat is a native module and is not present in Expo Go. Importing it
// there throws at module load, which would take down every screen that
// imports this file — so it is resolved lazily and its absence is a
// first-class state rather than a crash.
type PurchasesModule = typeof import("react-native-purchases").default;

let purchases: PurchasesModule | null = null;
let configured = false;
let unavailableReason: string | null = null;

function loadPurchases(): PurchasesModule | null {
  if (purchases) return purchases;
  if (unavailableReason) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    purchases = require("react-native-purchases").default as PurchasesModule;
    return purchases;
  } catch {
    unavailableReason =
      "Subscriptions need a development build — they cannot run in Expo Go.";
    return null;
  }
}

export type PurchasesStatus =
  | { available: true }
  | { available: false; reason: string };

export function purchasesStatus(): PurchasesStatus {
  if (!REVENUECAT_PUBLIC_KEY) {
    return {
      available: false,
      reason: "Subscriptions are not set up on this build yet.",
    };
  }

  if (!loadPurchases()) {
    return { available: false, reason: unavailableReason ?? "Unavailable." };
  }

  return { available: true };
}

/**
 * Configure once, keyed to our own user id.
 *
 * Passing appUserID ties the purchase to the account the server already
 * knows about, so the webhook can resolve it without a second mapping.
 */
export async function configurePurchases(appUserId: string): Promise<boolean> {
  if (configured) return true;

  const sdk = loadPurchases();
  if (!sdk || !REVENUECAT_PUBLIC_KEY) return false;

  try {
    await sdk.configure({ apiKey: REVENUECAT_PUBLIC_KEY, appUserID: appUserId });
    configured = true;
    return true;
  } catch (error) {
    console.error("Failed to configure purchases:", error);
    return false;
  }
}

export interface TrialTerms {
  /** e.g. "7 days" — rendered verbatim, never recomputed into marketing copy. */
  duration: string;
  /** What happens when it ends, in the store's own localised price. */
  thenPrice: string;
}

export interface Plan {
  id: string;
  /** Opaque handle passed back to purchase(). */
  packageId: string;
  title: string;
  description: string;
  /** Localised and formatted by the store. Display this, never a computed one. */
  priceString: string;
  /** "month" | "year" etc., as reported by the store. */
  period: string;
  trial: TrialTerms | null;
}

const PERIOD_LABEL: Record<string, string> = {
  P1W: "week",
  P1M: "month",
  P2M: "2 months",
  P3M: "3 months",
  P6M: "6 months",
  P1Y: "year",
};

function describePeriod(iso?: string | null): string {
  if (!iso) return "";
  return PERIOD_LABEL[iso] ?? iso.replace("P", "").toLowerCase();
}

function describeTrialDuration(unit?: string | null, count?: number | null): string {
  if (!unit || !count) return "";
  const singular = unit.toLowerCase().replace(/s$/, "");
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/**
 * Plans currently on sale, straight from the store.
 *
 * Returns an empty list rather than placeholder plans when nothing is
 * configured. A paywall showing invented prices is worse than one that admits
 * it has nothing to sell.
 */
export async function getPlans(): Promise<Plan[]> {
  const sdk = loadPurchases();
  if (!sdk) return [];

  try {
    const offerings = await sdk.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];

    return packages.map((pkg) => {
      const product = pkg.product;
      const intro = product.introPrice;

      return {
        id: product.identifier,
        packageId: pkg.identifier,
        title: product.title,
        description: product.description,
        priceString: product.priceString,
        period: describePeriod(product.subscriptionPeriod),
        trial:
          intro && intro.price === 0
            ? {
                duration: describeTrialDuration(intro.periodUnit, intro.periodNumberOfUnits),
                thenPrice: product.priceString,
              }
            : null,
      };
    });
  } catch (error) {
    console.error("Failed to load plans:", error);
    return [];
  }
}

export interface PurchaseOutcome {
  status: "purchased" | "cancelled" | "failed";
  /** Entitlement ids the store says are now active. */
  activeEntitlements: string[];
  message?: string;
}

export async function purchase(packageId: string): Promise<PurchaseOutcome> {
  const sdk = loadPurchases();
  if (!sdk) {
    return { status: "failed", activeEntitlements: [], message: unavailableReason ?? "Unavailable." };
  }

  try {
    const offerings = await sdk.getOfferings();
    const target = offerings.current?.availablePackages.find((p) => p.identifier === packageId);

    if (!target) {
      return { status: "failed", activeEntitlements: [], message: "That plan is no longer available." };
    }

    const { customerInfo } = await sdk.purchasePackage(target);

    return {
      status: "purchased",
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    };
  } catch (error) {
    // A cancellation is not an error to report. Showing "purchase failed"
    // after someone deliberately backed out is the kind of thing that reads
    // as pressure.
    const cancelled = (error as { userCancelled?: boolean })?.userCancelled;

    if (cancelled) {
      return { status: "cancelled", activeEntitlements: [] };
    }

    console.error("Purchase failed:", error);
    return {
      status: "failed",
      activeEntitlements: [],
      message: "That didn't go through. You have not been charged.",
    };
  }
}

/** Apple requires a restore path for anyone who reinstalls or changes device. */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  const sdk = loadPurchases();
  if (!sdk) {
    return { status: "failed", activeEntitlements: [], message: unavailableReason ?? "Unavailable." };
  }

  try {
    const customerInfo = await sdk.restorePurchases();
    const active = Object.keys(customerInfo.entitlements.active);

    return {
      status: "purchased",
      activeEntitlements: active,
      message: active.length === 0 ? "No previous purchases found on this Apple ID." : undefined,
    };
  } catch (error) {
    console.error("Restore failed:", error);
    return { status: "failed", activeEntitlements: [], message: "Couldn't restore. Try again." };
  }
}

/** Where Apple wants cancellation to happen. Never our own flow. */
export function manageSubscriptionsUrl(): string {
  return Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
}
