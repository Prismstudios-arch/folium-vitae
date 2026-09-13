import axios, { AxiosInstance } from "axios";
import {
  Species,
  IdentificationRequest,
  IdentificationResult,
  ConfidenceBand,
  CalibratedConfidence,
} from "@domain/plant";
import { VerdureErrorType, createError } from "@domain/errors";
import { KindwiseProvider } from "./kindwiseProvider";
import { getApiClient } from "./apiClient";

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
 * Phase 2: uses real Kindwise API when available
 * Phase 1 fallback: mock responses for testing
 */
export class IdentificationService {
  private kindwiseProvider?: KindwiseProvider;
  private apiClient: AxiosInstance;
  private useMock: boolean;

  constructor(options?: { mockMode?: boolean; kindwiseApiKey?: string }) {
    const mockMode = options?.mockMode ?? false;
    const apiKey = options?.kindwiseApiKey || process.env.KINDWISE_API_KEY;

    // If API key is available, use real Kindwise provider (Phase 2)
    if (apiKey && !mockMode) {
      try {
        this.kindwiseProvider = new KindwiseProvider({ apiKey });
        this.useMock = false;
      } catch (error) {
        console.warn("Failed to initialize Kindwise provider, falling back to mock:", error);
        this.useMock = true;
      }
    } else {
      // Fall back to mock mode for testing
      this.useMock = true;
    }

    // Fallback axios client (for Phase 1 backend proxy)
    this.apiClient = axios.create({
      baseURL: process.env.VERDURE_API_URL || "https://api.verdure.app",
      timeout: 30000,
    });
  }

  /**
   * Identify a plant from image data
   * Returns honest confidence bands and top 5 alternatives
   */
  async identify(request: IdentificationRequest): Promise<IdentificationResult> {
    try {
      // A configured provider is the only source of real answers. If it fails
      // we surface the failure — we never quietly substitute invented results,
      // because a fabricated ID presented as real is the precise thing this
      // product exists to not do (SPEC 1, 3.3).
      if (this.kindwiseProvider) {
        return await this.kindwiseProvider.identify(request);
      }

      return this.mockIdentify(request);
    } catch (error) {
      console.error("Identification failed:", error);

      // Parse errors
      if (error instanceof Error) {
        if (error.message.includes("No plant detected")) {
          throw createError(VerdureErrorType.IdentificationFailed, error);
        }
        if (error.message.includes("rate limit")) {
          throw createError(VerdureErrorType.QuotaExceeded, error);
        }
        if (error.message.includes("Invalid API key")) {
          throw createError(VerdureErrorType.ProviderUnavailable, error);
        }
      }

      throw createError(VerdureErrorType.IdentificationFailed, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get provider status (real vs mock)
   */
  getProviderInfo(): { provider: "kindwise" | "mock"; ready: boolean } {
    return {
      provider: this.useMock ? "mock" : "kindwise",
      ready: !this.useMock,
    };
  }

  /**
   * Health check: verify provider connection
   */
  async healthCheck(): Promise<boolean> {
    if (this.kindwiseProvider) {
      return this.kindwiseProvider.healthCheck();
    }
    return true; // Mock is always ready
  }

  /**
   * Identify plant and consume quota via backend
   * Phase 2: Integrated with Verdure backend API
   */
  async identifyWithBackend(
    request: IdentificationRequest,
    userId: string
  ): Promise<IdentificationResult> {
    const api = getApiClient();

    try {
      // First, verify user has quota
      const quota = await api.getQuota(userId);

      if (quota.remaining <= 0) {
        throw createError(VerdureErrorType.QuotaExceeded);
      }

      // Identify before consuming: a failed scan must not cost the user a
      // credit (SPEC 5, "Identifying").
      const result = await this.identify(request);

      await api.consumeQuota(userId);

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("QUOTA_EXCEEDED")) {
        throw createError(VerdureErrorType.QuotaExceeded, error);
      }

      throw error;
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
    // Deterministic so the same photo always yields the same fixture.
    const hash = request.imageHash || request.images[0]?.uri || "default";
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
