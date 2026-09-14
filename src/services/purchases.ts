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
 * the plan on the server comes from RevenueCat's own records, so premium is
 * not a boolean a client can flip (SPEC §6).
 */

import { Platform } from "react-native";
import { REVENUECAT_PUBLIC_KEY } from "@constants/config";
import { getApiClient } from "./apiClient";
import { cancelTrialReminder } from "./trialReminder";
import {
  TrialUnit,
  describePeriod,
  describeTrialDuration,
  normaliseTrialUnit,
} from "./subscriptionTerms";

// RevenueCat is a native module and is not present in Expo Go. Importing it
// there throws at module load, which would take down every screen that
// imports this file — so it is resolved lazily and its absence is a
// first-class state rather than a crash.
type PurchasesModule = typeof import("react-native-purchases").default;

let purchases: PurchasesModule | null = null;
let configuredUserId: string | null = null;
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
 * Start RevenueCat for this account, or move it to a new one.
 *
 * Nothing called this before. RevenueCat was never configured, so every
 * offerings request threw, the paywall always said it had nothing to show,
 * and no purchase could ever be made.
 *
 * Keyed to our own user id so the webhook resolves the purchase to the
 * account the server knows. If the account changes — deleting your data
 * signs you in as a new anonymous user — RevenueCat is moved with logIn,
 * since configuring twice is not supported.
 */
export async function configurePurchases(appUserId: string): Promise<boolean> {
  if (configuredUserId === appUserId) return true;

  const sdk = loadPurchases();
  if (!sdk || !REVENUECAT_PUBLIC_KEY) return false;

  try {
    if (configuredUserId === null) {
      sdk.configure({ apiKey: REVENUECAT_PUBLIC_KEY, appUserID: appUserId });
    } else {
      await sdk.logIn(appUserId);
    }

    configuredUserId = appUserId;
    void reconcileTrialReminder();
    return true;
  } catch (error) {
    console.error("Failed to configure purchases:", error);
    return false;
  }
}

/**
 * Drop the "trial ends in 2 days" reminder once it no longer applies.
 *
 * Someone who cancels during a trial would otherwise still be told, two days
 * out, that they are about to be charged — untrue, and alarming.
 */
async function reconcileTrialReminder(): Promise<void> {
  const sdk = loadPurchases();
  if (!sdk) return;

  try {
    const info = await sdk.getCustomerInfo();
    const trialStillRenewing = Object.values(info.entitlements.active).some(
      (entitlement) => entitlement.periodType === "TRIAL" && entitlement.willRenew
    );

    if (!trialStillRenewing) {
      await cancelTrialReminder();
    }
  } catch {
    // Can't tell right now. Leave the reminder as it is.
  }
}

export interface TrialTerms {
  /** e.g. "1 week" — rendered verbatim, never recomputed into marketing copy. */
  duration: string;
  unit: TrialUnit;
  count: number;
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
  /** "month", "3 months" and so on; empty if the store's period is unrecognised. */
  period: string;
  /** Present only when this Apple ID can actually get the trial. */
  trial: TrialTerms | null;
}

/**
 * Whether this Apple ID can still get each product's free trial.
 *
 * Apple grants one trial per subscription group. Anyone who has had one and
 * taps "Start 1 week free" is charged immediately — so the paywall used to
 * promise every returning user a trial it could not give them.
 *
 * Only a definite "eligible" counts. RevenueCat's guidance for an unknown
 * status is to show the non-trial price, and a paywall that under-promises is
 * the right way round.
 */
async function checkTrialEligibility(
  sdk: PurchasesModule,
  productIds: string[]
): Promise<Record<string, boolean>> {
  if (productIds.length === 0) return {};

  try {
    const result = await sdk.checkTrialOrIntroductoryPriceEligibility(productIds);
    const eligible = sdk.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;

    return Object.fromEntries(productIds.map((id) => [id, result[id]?.status === eligible]));
  } catch (error) {
    console.warn("Couldn't check trial eligibility:", error);
    return {};
  }
}

/**
 * Plans currently on sale, straight from the store.
 *
 * Returns an empty list rather than placeholder plans when nothing is
 * available. A paywall showing invented prices is worse than one that admits
 * it has nothing to sell.
 */
export async function getPlans(): Promise<Plan[]> {
  const sdk = loadPurchases();
  if (!sdk || configuredUserId === null) return [];

  try {
    const offerings = await sdk.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const eligibility = await checkTrialEligibility(
      sdk,
      packages.map((pkg) => pkg.product.identifier)
    );

    return packages.map((pkg) => {
      const product = pkg.product;
      const intro = product.introPrice;
      const unit = normaliseTrialUnit(intro?.periodUnit);
      const count = intro?.periodNumberOfUnits ?? 0;

      const offersFreeTrial = !!intro && intro.price === 0 && unit !== null && count > 0;

      return {
        id: product.identifier,
        packageId: pkg.identifier,
        title: product.title,
        description: product.description,
        priceString: product.priceString,
        period: describePeriod(product.subscriptionPeriod),
        trial:
          offersFreeTrial && unit !== null && eligibility[product.identifier]
            ? {
                duration: describeTrialDuration(unit, count),
                unit,
                count,
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
  if (!sdk || configuredUserId === null) {
    return {
      status: "failed",
      activeEntitlements: [],
      message: unavailableReason ?? "Couldn't connect to the App Store. You have not been charged.",
    };
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
  if (!sdk || configuredUserId === null) {
    return {
      status: "failed",
      activeEntitlements: [],
      message: unavailableReason ?? "Couldn't connect to the App Store. Try again in a moment.",
    };
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

/**
 * Have the server apply a purchase or restore now, rather than whenever
 * RevenueCat's webhook lands.
 *
 * Best effort. If it fails the webhook still applies the plan shortly; the
 * purchase itself is never in doubt.
 */
export async function syncEntitlementsWithServer(): Promise<boolean> {
  try {
    await getApiClient().syncSubscription();
    return true;
  } catch (error) {
    console.warn("Subscription sync didn't complete; the webhook will apply it:", error);
    return false;
  }
}

/** Where Apple wants cancellation to happen. Never our own flow. */
export function manageSubscriptionsUrl(): string {
  return Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
}
