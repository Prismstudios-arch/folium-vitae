import { useState, useCallback, useMemo } from "react";
import {
  IdentificationService,
  QuotaManager,
  calibrateConfidence,
} from "@services/identification";
import {
  IdentificationImage,
  IdentificationResult,
  CalibratedConfidence,
} from "@domain/plant";
import { VerdureError, VerdureErrorType, createError } from "@domain/errors";

/**
 * Hook for plant identification.
 * Owns the identify -> calibrate -> consume-credit sequence and the
 * surrounding UI state.
 */
export function useIdentification() {
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [confidence, setConfidence] = useState<CalibratedConfidence | null>(null);
  const [error, setError] = useState<VerdureError | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState(0);

  // Built once per mount. Constructing these on every render rebuilt the
  // HTTP client and quota reader on each keystroke.
  const identificationService = useMemo(() => new IdentificationService(), []);
  const quotaManager = useMemo(() => new QuotaManager(), []);

  const identify = useCallback(
    async (images: IdentificationImage[], imageHash: string) => {
      setIdentifying(true);
      setError(null);

      try {
        const quota = await quotaManager.getQuota();
        if (quota.remaining <= 0) {
          throw createError(VerdureErrorType.QuotaExceeded);
        }

        const identResult = await identificationService.identify({
          images,
          imageHash,
        });

        const topCandidate = identResult.candidates[0];
        if (!topCandidate) {
          throw createError(VerdureErrorType.IdentificationFailed);
        }

        const calibrated = calibrateConfidence(topCandidate.rawScore);

        setResult(identResult);
        setConfidence(calibrated);

        // Only charge a credit once we actually have an answer. Charging for
        // our own failure is exactly the behaviour this product rejects.
        await quotaManager.consumeCredit();
        setQuotaRemaining((await quotaManager.getQuota()).remaining);

        return { result: identResult, confidence: calibrated };
      } catch (err) {
        const verdureError = err as VerdureError;
        setError(verdureError);
        throw verdureError;
      } finally {
        setIdentifying(false);
      }
    },
    [identificationService, quotaManager]
  );

  const getQuotaInfo = useCallback(async () => {
    const quota = await quotaManager.getQuota();
    setQuotaRemaining(quota.remaining);
    return quota;
  }, [quotaManager]);

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
