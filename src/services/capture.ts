/**
 * Captured-photo handoff between the camera and the result screen.
 *
 * Base64 image data is far too large to pass through navigation params, and
 * re-reading the file on the next screen would decode it twice. So the
 * capture is held here and the route carries only its hash.
 */

import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";
import { IdentificationImage, PlantOrgan } from "@domain/plant";

/**
 * Longest edge sent to the provider.
 *
 * Providers downscale server-side anyway, so a full-resolution frame buys no
 * accuracy and costs upload time on a phone connection (SPEC §6).
 */
const UPLOAD_MAX_EDGE = 1024;

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

/**
 * Downscale and re-encode a capture for upload.
 *
 * Re-encoding is what strips EXIF. A photo straight off the camera carries
 * metadata that can include the GPS coordinates where it was taken — which,
 * for houseplants, is the user's home address. That must not leave the device
 * (SPEC §6, §10).
 *
 * manipulateAsync writes a fresh JPEG from decoded pixels, so no metadata
 * survives unless explicitly asked for. Nothing here asks for it.
 */
export async function prepareForUpload(uri: string): Promise<{ uri: string; base64: string }> {
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: UPLOAD_MAX_EDGE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!processed.base64) {
    throw new Error("Could not prepare the photo for upload");
  }

  return { uri: processed.uri, base64: processed.base64 };
}

export async function holdCapture(
  uri: string,
  _rawBase64: string,
  organ?: PlantOrgan
): Promise<Capture> {
  // Deliberately ignores the camera's own base64 and re-encodes instead. The
  // raw frame is both larger than the provider needs and carries EXIF.
  const { uri: cleanUri, base64 } = await prepareForUpload(uri);

  const hash = await hashImage(base64);
  const capture: Capture = { uri: cleanUri, base64, hash, organ, takenAt: new Date() };

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
