/**
 * Identification.
 *
 * This module holds the confidence thresholds and delegates the actual call
 * to our own API. It deliberately contains no provider client and no API key:
 * the app never talks to the vision provider directly (SPEC 6).
 */

import {
  IdentificationImage,
  IdentificationRequest,
  IdentificationResult,
  ConfidenceBand,
  CalibratedConfidence,
} from "@domain/plant";
import { getApiClient, ApiError, QuotaState } from "./apiClient";

// MARK: - Confidence Mapping

/**
 * Map raw provider scores to calibrated confidence bands.
 *
 * One owner for these thresholds, deliberately. The provider returns raw,
 * uncalibrated scores and they are banded here and nowhere else, so there is
 * a single place to retune once the Phase 0 evaluation gives real accuracy
 * figures (SPEC 3.3).
 */
export function mapConfidenceBand(rawScore: number): ConfidenceBand {
  // Top-1 correct ~90% of the time above this.
  if (rawScore >= 0.75) {
    return ConfidenceBand.Confident;
  }
  // Top-1 correct ~70% of the time above this.
  if (rawScore >= 0.5) {
    return ConfidenceBand.Probably;
  }
  // Below the threshold we show alternatives and no headline answer.
  return ConfidenceBand.NotSure;
}

export function calibrateConfidence(rawScore: number): CalibratedConfidence {
  return {
    band: mapConfidenceBand(rawScore),
    rawScore,
    calibratedScore: Math.min(Math.max(rawScore, 0), 1),
  };
}

// MARK: - Service

export interface IdentifyOutcome {
  result: IdentificationResult;
  confidence: CalibratedConfidence;
  /** True when the server answered from cache — no credit was spent. */
  cached: boolean;
  quota?: QuotaState;
}

export class IdentificationService {
  /**
   * Identify a plant.
   *
   * Errors propagate. There is no fallback that invents a species when the
   * request fails: presenting a fabricated answer as a real identification is
   * the single thing this product exists not to do (SPEC 1).
   */
  async identify(request: IdentificationRequest): Promise<IdentifyOutcome> {
    const withData = request.images.filter((image) => Boolean(image.base64));

    if (withData.length === 0) {
      throw new ApiError("No photo to identify.", 0, false);
    }

    const response = await getApiClient().identify(withData, request.imageHash);

    const top = response.candidates[0];

    if (!top) {
      throw new ApiError("We couldn't identify that one. Try a clearer photo.", 422, false);
    }

    return {
      result: response,
      confidence: calibrateConfidence(top.rawScore),
      cached: response.cached,
      quota: response.quota,
    };
  }

  /** Whether the API is reachable, for the offline banner. */
  async isReachable(): Promise<boolean> {
    return getApiClient().isReachable();
  }
}

/** Convenience for building a single-image request from a capture. */
export function toRequest(
  images: IdentificationImage[],
  imageHash: string
): IdentificationRequest {
  return { images, imageHash };
}
