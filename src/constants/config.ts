/**
 * Runtime configuration.
 *
 * Values come from app.json's `extra` block via expo-constants. Reading
 * process.env directly does not work in a release build — Metro only inlines
 * EXPO_PUBLIC_* at bundle time, so anything else silently reads undefined.
 *
 * Nothing secret belongs here. Everything in `extra` ships inside the app and
 * can be read out of the bundle, which is exactly why the identification API
 * key lives on the server and not in this file (SPEC 6).
 */

import Constants from "expo-constants";

interface AppExtra {
  apiUrl?: string;
  revenueCatPublicKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtra;

export const API_URL: string = extra.apiUrl ?? "http://localhost:3000";

/**
 * RevenueCat's *public* SDK key.
 *
 * This one is designed to ship inside the app — it can only read offerings
 * and start purchases Apple then verifies. It is not the secret key, which
 * lives on the server and must never appear here.
 *
 * Empty until configured, and the paywall says so rather than inventing
 * prices.
 */
export const REVENUECAT_PUBLIC_KEY: string = extra.revenueCatPublicKey ?? "";

/** How long to wait on an identification before giving up. */
export const IDENTIFY_TIMEOUT_MS = 45_000;

/** Everything else is fast; a long timeout just hides a dead server. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Contact and legal.
 *
 * SPEC §5 asks for "a real support email, not a form". This is that address,
 * kept in one place so the paywall, settings and the legal screens cannot
 * drift apart — App Store review checks that they agree.
 */
export const SUPPORT_EMAIL = "sorrelaiplant@outlook.com";

/**
 * App Store Connect requires a reachable privacy policy URL before a build
 * can be submitted; it is a mandatory field, not a nicety. The in-app screens
 * exist as well so the paywall can satisfy Guideline 3.1.2 and so the text is
 * readable offline.
 */
// Cloudflare Pages, built from docs/ on every push. The extension is omitted
// deliberately: Pages 308-redirects /privacy.html to /privacy, and the
// canonical form is what belongs in App Store Connect.
const LEGAL_SITE = "https://sorrel-34s.pages.dev";

export const PRIVACY_POLICY_URL = `${LEGAL_SITE}/privacy`;
export const TERMS_URL = `${LEGAL_SITE}/terms`;

/** Apple's own subscription management page. Never a link of our own. */
export const MANAGE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";

/** Shown on the legal screens so people know how current the text is. */
export const LEGAL_LAST_UPDATED = "14 September 2026";

if (!extra.apiUrl) {
  console.warn(
    "[config] No apiUrl in app.json extra — falling back to localhost. " +
      "Identification will not work on a physical device."
  );
}
