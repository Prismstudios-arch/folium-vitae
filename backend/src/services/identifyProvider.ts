/**
 * Kindwise (plant.id) client — server side only.
 *
 * This file is the reason /api/identify exists. The API key is read here and
 * nowhere the app bundle can reach, because a key extracted from a shipped
 * IPA on a metered vision API is an unbounded bill (SPEC 6).
 */

import axios, { AxiosInstance } from "axios";
import { ApiError } from "../middleware/errorHandler";
import logger from "../utils/logger";

export interface Species {
  id: string;
  scientificName: string;
  commonNames: string[];
  taxonomy: { family?: string; genus: string; species?: string };
  rawScore: number;
}

export interface IdentificationResult {
  candidates: Species[];
  provider: string;
  timestamp: string;
  feedbackToken?: string;
}

interface KindwiseSuggestion {
  id?: string;
  name: string;
  probability: number;
  details?: { common_names?: string[] | null; taxonomy?: { family?: string; genus?: string } };
}

interface KindwiseResponse {
  access_token?: string;
  result?: {
    is_plant?: { probability?: number; binary?: boolean };
    classification?: { suggestions?: KindwiseSuggestion[] };
  };
}

const IS_PLANT_THRESHOLD = 0.5;
const MAX_CANDIDATES = 5;

export function isProviderConfigured(): boolean {
  return Boolean(process.env.KINDWISE_API_KEY);
}

function toSpecies(suggestion: KindwiseSuggestion): Species {
  const scientificName = suggestion.name;
  const [genus, species] = scientificName.split(/\s+/);
  const commonNames = suggestion.details?.common_names ?? [];

  return {
    id: suggestion.id ?? scientificName.toLowerCase().replace(/\s+/g, "_"),
    scientificName,
    commonNames: commonNames.length > 0 ? commonNames : [scientificName],
    taxonomy: {
      family: suggestion.details?.taxonomy?.family,
      genus: suggestion.details?.taxonomy?.genus ?? genus ?? scientificName,
      species,
    },
    // Raw, uncalibrated. Banding happens in one place on the client so the
    // thresholds have a single owner (SPEC 3.3).
    rawScore: suggestion.probability,
  };
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: process.env.KINDWISE_BASE_URL || "https://plant.id/api/v3",
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });
  }
  return client;
}

/**
 * Identify a plant from one or more base64 images of the same specimen.
 *
 * Throws rather than returning a fabricated answer when the provider is
 * unavailable — an invented species presented as real is the one thing this
 * product must never do.
 */
export async function identify(
  imagesBase64: string[],
  organs?: string[]
): Promise<IdentificationResult> {
  const apiKey = process.env.KINDWISE_API_KEY;

  if (!apiKey) {
    throw ApiError.serviceUnavailable(
      "Plant identification is not configured on this server yet."
    );
  }

  if (imagesBase64.length === 0) {
    throw ApiError.badRequest("At least one image is required");
  }

  let response;

  try {
    response = await getClient().post<KindwiseResponse>(
      "/identification",
      {
        images: imagesBase64,
        // Ask for the fields the result screen actually renders, so we are
        // not paying for a second round trip to fill in common names.
        similar_images: true,
        ...(organs?.length ? { organs } : {}),
      },
      {
        params: { details: "common_names,taxonomy" },
        headers: { "Api-Key": apiKey },
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      // Never surface the provider's message verbatim — it can echo the key.
      if (status === 401 || status === 403) {
        logger.error("Kindwise rejected our API key");
        throw ApiError.serviceUnavailable("Identification is temporarily unavailable.");
      }
      if (status === 429) {
        throw ApiError.serviceUnavailable(
          "Identification is busy right now. Try again in a moment."
        );
      }
      if (status && status >= 500) {
        throw ApiError.serviceUnavailable(
          "The identification service is down. Try again shortly."
        );
      }
      if (error.code === "ECONNABORTED") {
        throw ApiError.serviceUnavailable("Identification timed out. Try again.");
      }
    }

    logger.error("Kindwise request failed:", error);
    throw ApiError.serviceUnavailable("Identification failed. Try again.");
  }

  const result = response.data.result;

  if ((result?.is_plant?.probability ?? 0) < IS_PLANT_THRESHOLD) {
    throw ApiError.unprocessable("We couldn't find a plant in that photo.");
  }

  const suggestions = (result?.classification?.suggestions ?? []).slice(0, MAX_CANDIDATES);

  if (suggestions.length === 0) {
    throw ApiError.unprocessable("We couldn't identify that one. Try a clearer photo.");
  }

  return {
    candidates: suggestions.map(toSpecies),
    provider: "kindwise",
    timestamp: new Date().toISOString(),
    feedbackToken: response.data.access_token,
  };
}

// ---------------------------------------------------------------------------
// Health assessment
// ---------------------------------------------------------------------------

export interface DiseaseFinding {
  id: string;
  name: string;
  /** Provider's raw probability. Not calibrated; the client bands it. */
  probability: number;
  description?: string;
  treatment?: { prevention?: string[]; chemical?: string[]; biological?: string[] };
}

export interface HealthAssessment {
  isHealthy: boolean;
  /** Confidence that the plant is healthy, 0-1. */
  healthyProbability: number;
  diseases: DiseaseFinding[];
  provider: string;
  timestamp: string;
}

interface KindwiseHealthResponse {
  result?: {
    is_healthy?: { binary?: boolean; probability?: number };
    disease?: {
      suggestions?: Array<{
        id?: string;
        name: string;
        probability: number;
        details?: {
          description?: string;
          treatment?: { prevention?: string[]; chemical?: string[]; biological?: string[] };
        };
      }>;
    };
  };
}

const MAX_DISEASES = 4;

/**
 * Assess plant health from photos.
 *
 * Throws when the provider is unavailable rather than returning a healthy
 * verdict. Telling somebody their sick plant is fine is worse than telling
 * them we could not look — they would stop investigating.
 */
export async function assessHealth(imagesBase64: string[]): Promise<HealthAssessment> {
  const apiKey = process.env.KINDWISE_API_KEY;

  if (!apiKey) {
    throw ApiError.serviceUnavailable("Health assessment is not configured on this server.");
  }

  if (imagesBase64.length === 0) {
    throw ApiError.badRequest("At least one image is required");
  }

  let response;

  try {
    response = await getClient().post<KindwiseHealthResponse>(
      "/health_assessment",
      { images: imagesBase64 },
      {
        params: { details: "description,treatment" },
        headers: { "Api-Key": apiKey },
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 401 || status === 403) {
        logger.error("Kindwise rejected our key on health assessment");
        throw ApiError.serviceUnavailable("Health checks are temporarily unavailable.");
      }
      if (status === 429) {
        throw ApiError.serviceUnavailable("Health checks are busy. Try again shortly.");
      }
    }

    logger.error("Health assessment failed:", error);
    throw ApiError.serviceUnavailable("Couldn't check this plant's health. Try again.");
  }

  const result = response.data.result;
  const healthyProbability = result?.is_healthy?.probability ?? 0;

  const diseases = (result?.disease?.suggestions ?? [])
    .slice(0, MAX_DISEASES)
    .map((suggestion) => ({
      id: suggestion.id ?? suggestion.name.toLowerCase().replace(/\s+/g, "_"),
      name: suggestion.name,
      probability: suggestion.probability,
      description: suggestion.details?.description,
      treatment: suggestion.details?.treatment,
    }));

  return {
    // Trust the provider's own binary verdict rather than re-deriving one
    // from a threshold we have not calibrated (SPEC §3.3).
    isHealthy: result?.is_healthy?.binary ?? false,
    healthyProbability,
    diseases,
    provider: "kindwise",
    timestamp: new Date().toISOString(),
  };
}
