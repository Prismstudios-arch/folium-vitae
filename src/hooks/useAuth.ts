import { useState, useEffect, useCallback } from "react";
import { getApiClient, ApiError, PublicUser } from "@services/apiClient";
import { bootstrapSession, getDeviceId } from "@services/session";

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Set when we could not reach the API. The app still works offline. */
  isOffline: boolean;
  error: string | null;
}

/**
 * Session lifecycle.
 *
 * On mount this restores a stored session or creates an anonymous one, so a
 * first-run user can scan without ever seeing a sign-up screen (SPEC 9).
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isOffline: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await bootstrapSession();

      // The component can unmount while the request is in flight; setting
      // state afterwards would warn and leak.
      if (cancelled) return;

      setState({
        user: session.user,
        isAuthenticated: getApiClient().isAuthenticated(),
        isLoading: false,
        isOffline: !session.online,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const user = await getApiClient().register(email, password, displayName);
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          isOffline: false,
          error: null,
        });
        return user;
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Couldn't create account.";
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        throw error;
      }
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const user = await getApiClient().login(email, password);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        isOffline: false,
        error: null,
      });
      return user;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Couldn't sign in.";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  /**
   * Sign out back to anonymous rather than to nothing. Dropping the session
   * entirely would strand the user on a screen they cannot leave without an
   * account, which the product does not require.
   */
  const logout = useCallback(async () => {
    const api = getApiClient();
    await api.logout();

    try {
      const user = await api.loginAnonymous(await getDeviceId());
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        isOffline: false,
        error: null,
      });
    } catch {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isOffline: true,
        error: null,
      });
    }
  }, []);

  return { ...state, register, login, logout };
}
