import { useCallback } from "react";
import { useRouter } from "expo-router";

/**
 * A back action that always goes somewhere.
 *
 * router.back() silently does nothing when there is no history, which
 * happens whenever a screen is reached via router.replace — onboarding does
 * exactly that into the scanner. The result is a dead button and a user with
 * no way out of the screen.
 *
 * Falls back to the given route, or home.
 */
export function useGoBack(fallback: string = "/") {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as never);
    }
  }, [router, fallback]);
}
