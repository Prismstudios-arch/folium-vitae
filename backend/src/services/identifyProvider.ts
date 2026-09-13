/**
 * Kindwise (plant.id) client — server side only.
 *
 * This file is the reason /api/identify exists. The API key is read here and
 * nowhere the app bundle can reach, because a key extracted from a shipped
 * IPA on a metered vision API is an unbounded bill (SPEC 6).
 */

import axios, { AxiosInstance } from "axios";
import { VerdureError } from "../middleware/errorHandler";
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
    throw VerdureError.serviceUnavailable(
      "Plant identification is not configured on this server yet."
    );
  }

  if (imagesBase64.length === 0) {
    throw VerdureError.badRequest("At least one image is required");
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
        throw VerdureError.serviceUnavailable("Identification is temporarily unavailable.");
      }
      if (status === 429) {
        throw VerdureError.serviceUnavailable(
          "Identification is busy right now. Try again in a moment."
        );
      }
      if (status && status >= 500) {
        throw VerdureError.serviceUnavailable(
          "The identification service is down. Try again shortly."
        );
      }
      if (error.code === "ECONNABORTED") {
        throw VerdureError.serviceUnavailable("Identification timed out. Try again.");
      }
    }

    logger.error("Kindwise request failed:", error);
    throw VerdureError.serviceUnavailable("Identification failed. Try again.");
  }

  const result = response.data.result;

  if ((result?.is_plant?.probability ?? 0) < IS_PLANT_THRESHOLD) {
    throw VerdureError.unprocessable("We couldn't find a plant in that photo.");
  }

  const suggestions = (result?.classification?.suggestions ?? []).slice(0, MAX_CANDIDATES);

  if (suggestions.length === 0) {
    throw VerdureError.unprocessable("We couldn't identify that one. Try a clearer photo.");
  }

  return {
    candidates: suggestions.map(toSpecies),
    provider: "kindwise",
    timestamp: new Date().toISOString(),
    feedbackToken: response.data.access_token,
  };
}
