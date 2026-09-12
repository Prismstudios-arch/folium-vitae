/**
 * Kindwise API Provider
 * Real plant identification via Kindwise API
 * Supports: Plant ID, Disease Detection, Gardening Chat
 */

import axios, { AxiosInstance } from "axios";
import { Species, IdentificationResult, CalibratedConfidence } from "@types/plant";
import { calibrateConfidence } from "./identification";

export interface KindwiseConfig {
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface KindwiseResponse {
  result: {
    is_plant: {
      probability: number;
    };
    classification: {
      suggestions: Array<{
        name: {
          scientific_name: string;
          common_names: string[];
        };
        probability: number;
        details?: {
          description?: string;
          taxonomy?: {
            class?: string;
            family?: string;
            genus?: string;
            order?: string;
            phylum?: string;
            species?: string;
          };
          characteristics?: {
            toxicity?: string;
            watering?: string;
            sunlight?: string;
          };
        };
      }>;
    };
  };
  feedback_token?: string;
}

export interface DiseaseDetectionResponse {
  result: {
    is_plant: {
      probability: number;
    };
    disease: {
      suggestions: Array<{
        name: {
          common_name: string;
          scientific_name?: string;
        };
        probability: number;
        description?: string;
        treatment?: string;
      }>;
    };
  };
  feedback_token?: string;
}

export class KindwiseProvider {
  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret?: string;

  constructor(config: KindwiseConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    this.client = axios.create({
      baseURL: config.baseUrl || "https://plant.id/api/v3",
      timeout: config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Identify a plant from image
   * @param imageBase64 Base64 encoded image
   * @param imageHash Optional hash for caching (client-side feedback)
   * @returns Identification result with top 5 candidates
   */
  async identify(imageBase64: string, imageHash?: string): Promise<IdentificationResult> {
    try {
      if (!imageBase64) {
        throw new Error("Image required for identification");
      }

      const response = await this.client.post<KindwiseResponse>(
        "/identification",
        {
          images: [imageBase64],
          moderation: false,
        },
        {
          params: {
            api_key: this.apiKey,
          },
        }
      );

      const apiResult = response.data.result;

      // Check if image contains a plant
      if ((apiResult.is_plant?.probability ?? 0) < 0.5) {
        throw new Error("No plant detected in image. Please aim at a plant.");
      }

      // Parse top 5 candidates
      const candidates = (apiResult.classification?.suggestions ?? []).slice(0, 5);

      if (candidates.length === 0) {
        throw new Error("Unable to identify plant. Try a clearer photo.");
      }

      // Build identification result
      const topCandidate = candidates[0];
      const topConfidence = calibrateConfidence(topCandidate.probability);

      const result: IdentificationResult = {
        topCandidate: {
          commonNames: topCandidate.name.common_names || [
            topCandidate.name.scientific_name,
          ],
          scientificName: topCandidate.name.scientific_name,
          confidence: topConfidence,
          feedbackToken: response.data.feedback_token,
          plantId: topCandidate.name.scientific_name.toLowerCase().replace(/\s+/g, "_"),
        },
        alternatives: candidates.slice(1).map((candidate) => ({
          commonNames: candidate.name.common_names || [candidate.name.scientific_name],
          scientificName: candidate.name.scientific_name,
          confidence: calibrateConfidence(candidate.probability),
          plantId: candidate.name.scientific_name.toLowerCase().replace(/\s+/g, "_"),
        })),
        metadata: {
          imageHash: imageHash,
          apiProvider: "kindwise",
          identifiedAt: new Date().toISOString(),
          modelVersion: "plant.id/v3",
        },
      };

      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 401) {
          throw new Error("Invalid API key. Check KINDWISE_API_KEY environment variable.");
        } else if (status === 429) {
          throw new Error(
            "API rate limit exceeded. Please wait a moment and try again."
          );
        } else if (status === 400) {
          throw new Error(`Invalid request: ${message}`);
        } else if (status === 500) {
          throw new Error("Kindwise service temporarily unavailable. Try again in a moment.");
        }
      }

      if (error instanceof Error) {
        throw new Error(`Identification failed: ${error.message}`);
      }

      throw new Error("Identification failed. Please try again.");
    }
  }

  /**
   * Detect plant diseases from image
   * @param imageBase64 Base64 encoded image
   * @returns Disease detection results
   */
  async detectDisease(imageBase64: string): Promise<DiseaseDetectionResponse> {
    try {
      if (!imageBase64) {
        throw new Error("Image required for disease detection");
      }

      const response = await this.client.post<DiseaseDetectionResponse>(
        "/disease_detection",
        {
          images: [imageBase64],
          moderation: false,
        },
        {
          params: {
            api_key: this.apiKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401) {
          throw new Error("Invalid API key for disease detection.");
        } else if (status === 429) {
          throw new Error("Rate limit exceeded. Please wait before trying again.");
        }
      }

      throw new Error("Disease detection failed. Please try again.");
    }
  }

  /**
   * Send feedback to Kindwise for model improvement
   * @param feedbackToken Token from identification response
   * @param correct Whether the identification was correct
   * @param correctName Optional correct plant name if identification was wrong
   */
  async sendFeedback(
    feedbackToken: string,
    correct: boolean,
    correctName?: string
  ): Promise<void> {
    try {
      if (!feedbackToken) {
        console.warn("No feedback token provided");
        return;
      }

      await this.client.post(
        `/feedback/${feedbackToken}`,
        {
          is_correct: correct,
          suggested_plant: correctName,
        },
        {
          params: {
            api_key: this.apiKey,
          },
        }
      );
    } catch (error) {
      console.error("Failed to send feedback to Kindwise:", error);
      // Don't throw - feedback is not critical
    }
  }

  /**
   * Health check - verify API connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple API call to verify credentials
      const response = await this.client.post(
        "/identification",
        {
          images: ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="], // 1x1 pixel
          moderation: false,
        },
        {
          params: {
            api_key: this.apiKey,
          },
        }
      );

      return !!response.data;
    } catch (error) {
      console.error("Kindwise health check failed:", error);
      return false;
    }
  }
}

/**
 * Create Kindwise provider from environment variables
 * Requires: KINDWISE_API_KEY
 * Optional: KINDWISE_API_SECRET, KINDWISE_BASE_URL
 */
export function createKindwiseProvider(): KindwiseProvider {
  const apiKey = process.env.KINDWISE_API_KEY || "";

  if (!apiKey) {
    console.warn(
      "KINDWISE_API_KEY not set. Plant identification will use mock mode. " +
        "To use real API, set KINDWISE_API_KEY environment variable."
    );
  }

  return new KindwiseProvider({
    apiKey,
    apiSecret: process.env.KINDWISE_API_SECRET,
    baseUrl: process.env.KINDWISE_BASE_URL,
  });
}
