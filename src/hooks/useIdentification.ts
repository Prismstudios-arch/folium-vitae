import { useState, useCallback, useMemo } from "react";
import { IdentificationService } from "@services/identification";
import { ApiError, QuotaState, getApiClient } from "@services/apiClient";
import {
  IdentificationImage,
  IdentificationResult,
  CalibratedConfidence,
} from "@domain/plant";

/**
 * Identification flow state.
 *
 * Quota is read from the server rather than counted locally. A client-side
 * counter is both defeatable (reinstall, change the clock) and liable to
 * disagree with the server, which would mean showing someone "4 left" and
 * then refusing them (SPEC 6).
 */
export function useIdentification() {
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [confidence, setConfidence] = useState<CalibratedConfidence | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);

  const service = useMemo(() => new IdentificationService(), []);

  const identify = useCallback(
    async (images: IdentificationImage[], imageHash: string) => {
      setIdentifying(true);
      setError(null);

      try {
        const outcome = await service.identify({ images, imageHash });

        setResult(outcome.result);
        setConfidence(outcome.confidence);

        // The server returns the post-scan quota, so there is no second round
        // trip and no window where the two disagree.
        if (outcome.quota) {
          setQuota(outcome.quota);
        }

        return outcome;
      } catch (err) {
        const apiError =
          err instanceof ApiError ? err : new ApiError("Something went wrong.", 0, false);
        setError(apiError);
        throw apiError;
      } finally {
        setIdentifying(false);
      }
    },
    [service]
  );

  const refreshQuota = useCallback(async () => {
    try {
      const current = await getApiClient().getQuota();
      setQuota(current);
      return current;
    } catch {
      // Quota display is not worth surfacing an error for; the scan itself
      // will report the real state.
      return null;
    }
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
    quota,
    quotaRemaining: quota?.remaining ?? null,
    identify,
    refreshQuota,
    reset,
  };
}
