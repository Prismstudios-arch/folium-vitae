import axios, { AxiosInstance } from "axios";
import { Species, IdentificationResult, ConfidenceBand, CalibratedConfidence } from "@types/plant";
import { VerdureErrorType, createError } from "@types/errors";

// MARK: - Confidence Mapping

/**
 * Map raw provider scores to calibrated confidence bands
 * Based on thresholds where model is ~90% / ~70% / <50% accurate
 */
export function mapConfidenceBand(rawScore: number): ConfidenceBand {
  // Thresholds (would be tuned based on Phase 0 evaluation)
  // Top-1 correct ~90% of the time
  if (rawScore >= 0.75) {
    return ConfidenceBand.Confident;
  }
  // Top-1 correct ~70% of the time
  if (rawScore >= 0.50) {
    return ConfidenceBand.Probably;
  }
  // Below threshold: show alternatives, not confident
  return ConfidenceBand.NotSure;
}

export function calibrateConfidence(rawScore: number): CalibratedConfidence {
  const band = mapConfidenceBand(rawScore);

  // Calibrated score: map raw to 0-1 range
  // For now, just normalize; production would use proper calibration
  const calibratedScore = Math.min(Math.max(rawScore, 0), 1);

  return {
    band,
    rawScore,
    calibratedScore,
  };
}

// MARK: - Identification Service

export interface IdentificationRequest {
  imageBase64?: string;
  imageUri?: string;
  imageHash?: string;
}

export interface KindwiseResponse {
  predictions: Array<{
    plant_name: string;
    plant_details?: {
      taxonomy?: {
        genus?: string;
        family?: string;
        species?: string;
      };
      common_names?: string[];
    };
    probability: number;
  }>;
}

/**
 * Service for plant identification
 * In production: calls backend proxy
 * In Phase 1: mock responses for testing
 */
export class IdentificationService {
  private backendUrl: string;
  private apiClient: AxiosInstance;
  private useMock: boolean;

  constructor(backendUrl: string = "https://api.verdure.app", useMock: boolean = true) {
    this.backendUrl = backendUrl;
    this.useMock = useMock;

    this.apiClient = axios.create({
      baseURL: backendUrl,
      timeout: 30000,
    });
  }

  /**
   * Identify a plant from image data
   */
  async identify(request: IdentificationRequest): Promise<IdentificationResult> {
    try {
      // Use mock responses in Phase 1
      if (this.useMock) {
        return this.mockIdentify(request);
      }

      // Production: send to backend proxy
      const response = await this.apiClient.post<KindwiseResponse>("/identify", {
        imageUri: request.imageUri,
        imageHash: request.imageHash,
      });

      return this.parseKindwiseResponse(response.data);
    } catch (error) {
      console.error("Identification failed:", error);

      // Parse axios errors
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw createError(VerdureErrorType.NoInternetConnection);
        }

        if (error.response.status === 429) {
          throw createError(VerdureErrorType.QuotaExceeded);
        }

        if (error.response.status >= 500) {
          throw createError(VerdureErrorType.ProviderUnavailable);
        }
      }

      throw createError(VerdureErrorType.IdentificationFailed, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Parse Kindwise API response into our format
   */
  private parseKindwiseResponse(response: KindwiseResponse): IdentificationResult {
    const candidates: Species[] = response.predictions
      .slice(0, 5) // Top 5 candidates
      .map((pred, idx) => ({
        id: `${idx}`,
        scientificName: pred.plant_details?.taxonomy?.species || pred.plant_name,
        commonNames: pred.plant_details?.common_names || [pred.plant_name],
        taxonomy: {
          family: pred.plant_details?.taxonomy?.family || "Unknown",
          genus: pred.plant_details?.taxonomy?.genus || "Unknown",
          species: pred.plant_details?.taxonomy?.species,
        },
        rawScore: pred.probability,
      }));

    return {
      candidates,
      provider: "kindwise",
      timestamp: new Date(),
    };
  }

  /**
   * Mock identification for Phase 1 testing
   */
  private mockIdentify(request: IdentificationRequest): IdentificationResult {
    // Deterministic mocking based on image URI (for testing)
    const hash = request.imageHash || request.imageUri || "default";
    const seed = hash.charCodeAt(0) % 10;

    const mockPlants = [
      {
        name: "Monstera deliciosa",
        common: ["Swiss Cheese Plant", "Monstera"],
        family: "Araceae",
        genus: "Monstera",
        scores: [0.92, 0.05, 0.02, 0.01],
      },
      {
        name: "Pothos",
        common: ["Devil's Ivy", "Pothos"],
        family: "Araceae",
        genus: "Epipremnum",
        scores: [0.87, 0.08, 0.03, 0.02],
      },
      {
        name: "Ficus elastica",
        common: ["Rubber Plant", "Rubber Fig"],
        family: "Moraceae",
        genus: "Ficus",
        scores: [0.85, 0.09, 0.04, 0.02],
      },
      {
        name: "Pilea peperomioides",
        common: ["Chinese Money Plant", "UFO Plant"],
        family: "Urticaceae",
        genus: "Pilea",
        scores: [0.88, 0.07, 0.03, 0.02],
      },
    ];

    const plant = mockPlants[seed % mockPlants.length];

    const candidates: Species[] = plant.scores.map((score, idx) => ({
      id: `${idx}`,
      scientificName: plant.name,
      commonNames: plant.common,
      taxonomy: {
        family: plant.family,
        genus: plant.genus,
      },
      rawScore: score,
    }));

    return {
      candidates,
      provider: "mock",
      timestamp: new Date(),
    };
  }
}

// MARK: - Quota Management

/**
 * Simple quota tracker for Phase 1
 * Production would use DeviceCheck tokens + server-side verification
 */
export class QuotaManager {
  private dailyLimit = 7;
  private storageKey = "verdure_quota";

  private getToday(): string {
    return new Date().toDateString();
  }

  /**
   * Check if user can scan today
   */
  async canScan(): Promise<boolean> {
    const quota = await this.getQuota();
    return quota.remaining > 0;
  }

  /**
   * Get current quota info
   */
  async getQuota(): Promise<{ used: number; remaining: number; resetsAt: Date }> {
    // In Phase 1, use AsyncStorage
    // Production would use backend verification
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      const stored = await AsyncStorage.getItem(this.storageKey);

      if (!stored) {
        return {
          used: 0,
          remaining: this.dailyLimit,
          resetsAt: this.getTomorrowMidnight(),
        };
      }

      const data = JSON.parse(stored);
      const today = this.getToday();

      if (data.date !== today) {
        // New day, reset quota
        return {
          used: 0,
          remaining: this.dailyLimit,
          resetsAt: this.getTomorrowMidnight(),
        };
      }

      return {
        used: data.used,
        remaining: Math.max(0, this.dailyLimit - data.used),
        resetsAt: this.getTomorrowMidnight(),
      };
    } catch (error) {
      console.error("Failed to get quota:", error);
      // Assume no quota on error (failsafe)
      return {
        used: 0,
        remaining: this.dailyLimit,
        resetsAt: this.getTomorrowMidnight(),
      };
    }
  }

  /**
   * Consume one scan credit
   */
  async consumeCredit(): Promise<void> {
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      const quota = await this.getQuota();

      if (quota.remaining <= 0) {
        throw createError(VerdureErrorType.QuotaExceeded);
      }

      const today = this.getToday();
      await AsyncStorage.setItem(
        this.storageKey,
        JSON.stringify({
          date: today,
          used: quota.used + 1,
        })
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("QUOTA_EXCEEDED")) {
        throw error;
      }
      console.error("Failed to consume credit:", error);
    }
  }

  /**
   * Get reset time
   */
  private getTomorrowMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Reset quota (for testing)
   */
  async resetForTesting(): Promise<void> {
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error("Failed to reset quota:", error);
    }
  }
}
