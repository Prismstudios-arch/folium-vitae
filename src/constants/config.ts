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
}

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtra;

export const API_URL: string = extra.apiUrl ?? "http://localhost:3000";

/** How long to wait on an identification before giving up. */
export const IDENTIFY_TIMEOUT_MS = 45_000;

/** Everything else is fast; a long timeout just hides a dead server. */
export const DEFAULT_TIMEOUT_MS = 15_000;

if (!extra.apiUrl) {
  console.warn(
    "[config] No apiUrl in app.json extra — falling back to localhost. " +
      "Identification will not work on a physical device."
  );
}
