/**
 * Captured-photo handoff between the camera and the result screen.
 *
 * Base64 image data is far too large to pass through navigation params, and
 * re-reading the file on the next screen would decode it twice. So the
 * capture is held here and the route carries only its hash.
 */

import * as Crypto from "expo-crypto";
import { IdentificationImage, PlantOrgan } from "@domain/plant";

export interface Capture {
  uri: string;
  base64: string;
  hash: string;
  organ?: PlantOrgan;
  takenAt: Date;
}

/**
 * SHA-256 of the image bytes.
 *
 * This is the server's cache key, so a collision would hand one person
 * another person's identification. That rules out the cheap 32-bit string
 * hashes — at a few tens of thousands of images a collision is likely.
 */
export async function hashImage(base64: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
}

// Keyed by hash. Bounded because a long session should not accumulate
// megabytes of base64 that nothing will read again.
const MAX_HELD = 5;
const captures = new Map<string, Capture>();

export async function holdCapture(
  uri: string,
  base64: string,
  organ?: PlantOrgan
): Promise<Capture> {
  const hash = await hashImage(base64);
  const capture: Capture = { uri, base64, hash, organ, takenAt: new Date() };

  captures.set(hash, capture);

  while (captures.size > MAX_HELD) {
    // Map preserves insertion order, so the first key is the oldest.
    const oldest = captures.keys().next().value;
    if (oldest === undefined) break;
    captures.delete(oldest);
  }

  return capture;
}

export function getCapture(hash: string): Capture | undefined {
  return captures.get(hash);
}

export function releaseCapture(hash: string): void {
  captures.delete(hash);
}

/** Shape a held capture for an identification request. */
export function toIdentificationImage(capture: Capture): IdentificationImage {
  return { uri: capture.uri, base64: capture.base64, organ: capture.organ };
}
