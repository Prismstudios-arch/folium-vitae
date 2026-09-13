/**
 * Image quality analysis for pre-flight checks.
 *
 * These are the checks that decide whether a photo is worth sending to a
 * paid identification call (SPEC 3.2). Everything in this file is a pure
 * function over pixel data so it can be tested against real values rather
 * than asserted about.
 */

export enum LightLevel {
  TooDark = "tooDark",
  Low = "low",
  Good = "good",
  BlownOut = "blownOut",
}

/**
 * Rec. 601 luma. Green dominates because human vision is most sensitive to
 * it — a plain RGB mean would rate a saturated red and a mid grey as equally
 * bright, which they are not.
 */
export function toGrayscale(rgba: Uint8Array | Uint8ClampedArray, pixelCount: number): Float32Array {
  const gray = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    gray[i] =
      0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2];
  }

  return gray;
}

/**
 * Variance of the Laplacian — the standard sharpness measure.
 *
 * The Laplacian is a second-derivative operator, so it responds to edges. A
 * sharp photo has many strong edges and therefore a wide spread of responses;
 * blur suppresses those edges and collapses the variance toward zero.
 *
 * Returns 0 for images too small to have an interior.
 */
export function laplacianVariance(
  gray: Float32Array,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) {
    return 0;
  }

  const responses: number[] = [];

  // Skip the border: the kernel needs all four neighbours, and clamping at
  // the edge invents gradients that are not in the image.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;

      //  0  1  0
      //  1 -4  1
      //  0  1  0
      const response =
        gray[i - width] + gray[i - 1] - 4 * gray[i] + gray[i + 1] + gray[i + width];

      responses.push(response);
    }
  }

  const mean = responses.reduce((sum, value) => sum + value, 0) / responses.length;
  const variance =
    responses.reduce((sum, value) => sum + (value - mean) ** 2, 0) / responses.length;

  return variance;
}

export function meanLuminance(gray: Float32Array): number {
  if (gray.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < gray.length; i++) {
    total += gray[i];
  }

  return total / gray.length;
}

/**
 * Fraction of pixels at the top of the range.
 *
 * Mean luminance alone cannot tell a well-exposed photo from one with a
 * blown-out window behind the plant — both average to "fine" while the
 * subject in the second is a silhouette.
 */
export function clippedHighlightRatio(gray: Float32Array, threshold = 250): number {
  if (gray.length === 0) return 0;

  let clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] >= threshold) clipped++;
  }

  return clipped / gray.length;
}

export function classifyLight(mean: number, clippedRatio: number): LightLevel {
  // Order matters: a blown-out frame can still have a middling mean.
  if (clippedRatio > 0.25) return LightLevel.BlownOut;
  if (mean < 40) return LightLevel.TooDark;
  if (mean < 70) return LightLevel.Low;
  return LightLevel.Good;
}

/**
 * Sharpness threshold, measured on the normalised 96px-wide analysis frame.
 *
 * Provisional. Like the confidence bands, this wants calibrating against a
 * real corpus of accepted and rejected photos rather than being guessed —
 * it is set deliberately permissive for now so the failure mode is letting a
 * marginal photo through rather than rejecting a good one. Telling someone
 * their sharp photo is blurry is the worse error.
 */
export const SHARPNESS_THRESHOLD = 55;

export interface ImageQuality {
  sharpness: number;
  isBlurry: boolean;
  meanLuminance: number;
  clippedHighlightRatio: number;
  light: LightLevel;
}

export function analyseGrayscale(
  gray: Float32Array,
  width: number,
  height: number
): ImageQuality {
  const sharpness = laplacianVariance(gray, width, height);
  const mean = meanLuminance(gray);
  const clipped = clippedHighlightRatio(gray);

  return {
    sharpness,
    isBlurry: sharpness < SHARPNESS_THRESHOLD,
    meanLuminance: mean,
    clippedHighlightRatio: clipped,
    light: classifyLight(mean, clipped),
  };
}
