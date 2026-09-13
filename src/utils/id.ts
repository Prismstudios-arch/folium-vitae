/**
 * Identifier generation.
 */

import * as Crypto from "expo-crypto";

/**
 * A v4 UUID from the platform CSPRNG.
 *
 * Math.random() is not a suitable source here. These ids key the device
 * account and every locally stored plant, so a collision merges two people's
 * collections — and Math.random() is seeded per JS context, which on a fresh
 * install is far more predictable than it looks.
 */
export function generateId(): string {
  return Crypto.randomUUID();
}
