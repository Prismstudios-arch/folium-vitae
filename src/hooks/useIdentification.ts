import { useState, useCallback } from "react";
import { IdentificationService, QuotaManager } from "@services/identification";
import { IdentificationResult, CalibratedConfidence, ConfidenceBand } from "@types/plant";
import { VerdureError } from "@types/errors";

/**
 * Hook for plant identification
 * Manages identification state, quota, and error handling
 */
export function useIdentification() {
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [confidence, setConfidence] = useState<CalibratedConfidence | null>(null);
  const [error, setError] = useState<VerdureError | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState(7);

  const identificationService = new IdentificationService("https://api.verdure.app", true); // Mock mode
  const quotaManager = new QuotaManager();

  const identify = useCallback(
    async (imageUri: string, imageHash?: string) => {
      try {
        setIdentifying(true);
        setError(null);

        // Check quota first
        const quota = await quotaManager.getQuota();
        if (!quota.remaining) {
          throw {
            type: "QUOTA_EXCEEDED",
            message: "Daily limit reached",
            description: "You've reached your daily scan limit",
            recovery: `Your limit resets at ${quota.resetsAt.toLocaleTimeString()}`,
          } as VerdureError;
        }

        // Identify the plant
        const identResult = await identificationService.identify({
          imageUri,
          imageHash,
        });

        // Get top candidate and calibrate confidence
        const topCandidate = identResult.candidates[0];
        if (!topCandidate) {
          throw {
            type: "IDENTIFICATION_FAILED",
            message: "No candidates returned",
            description: "Couldn't identify this plant",
          } as VerdureError;
        }

        // Calibrate confidence
        const { mapConfidenceBand, calibrateConfidence } = require("@services/identification");
        const calibratedConf = calibrateConfidence(topCandidate.rawScore);

        setResult(identResult);
        setConfidence(calibratedConf);

        // Consume a credit
        await quotaManager.consumeCredit();
        const newQuota = await quotaManager.getQuota();
        setQuotaRemaining(newQuota.remaining);

        return {
          result: identResult,
          confidence: calibratedConf,
        };
      } catch (err) {
        const error = err as VerdureError;
        setError(error);
        throw error;
      } finally {
        setIdentifying(false);
      }
    },
    []
  );

  const getQuotaInfo = useCallback(async () => {
    const quota = await quotaManager.getQuota();
    setQuotaRemaining(quota.remaining);
    return quota;
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setConfidence(null);
    setError(null);
  }, []);

  return {
    identifying,
    result,
    confidence,
    error,
    quotaRemaining,
    identify,
    getQuotaInfo,
    reset,
  };
}
