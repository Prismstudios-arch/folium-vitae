/**
 * useAuth Hook
 * Phase 2: User authentication and session management
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiClient, AuthToken } from "@services/apiClient";
import { VerdureErrorType, createError } from "@domain/errors";

interface AuthState {
  user: { id: string; email?: string; displayName: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useAuth() {
  const router = useRouter();
  const api = getApiClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Try to restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  /**
   * Restore authentication from stored token
   */
  const restoreSession = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Try to restore auth token
      const restored = await api.restoreAuth();

      if (restored) {
        const userId = api.getCurrentUserId();
        if (userId) {
          setState((prev) => ({
            ...prev,
            user: { id: userId, displayName: "User" },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }));
          return;
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to restore session:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  /**
   * Register with email/password
   */
  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const token = await api.register(email, password, displayName);

        setState({
          user: { id: token.userId, email, displayName },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        router.replace("/scan");
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Registration failed");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err,
        }));
        throw err;
      }
    },
    [api, router]
  );

  /**
   * Login with email/password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const token = await api.login(email, password);

        setState({
          user: { id: token.userId, email, displayName: email.split("@")[0] },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        router.replace("/scan");
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Login failed");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err,
        }));
        throw err;
      }
    },
    [api, router]
  );

  /**
   * Login anonymously (Phase 1 users)
   */
  const loginAnonymous = useCallback(
    async (deviceId?: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const id = deviceId || (await getDeviceId());
        const token = await api.loginAnonymous(id);

        setState({
          user: { id: token.userId, displayName: "You" },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        router.replace("/scan");
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Login failed");
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err,
        }));
        throw err;
      }
    },
    [api, router]
  );

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      await api.logout();

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      router.replace("/onboarding");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [api, router]);

  return {
    ...state,
    register,
    login,
    loginAnonymous,
    logout,
  };
}

/**
 * Helper: Get or create device ID
 */
async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem("verdure_device_id");

    if (!deviceId) {
      // Generate new device ID
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem("verdure_device_id", deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error("Failed to get device ID:", error);
    return `device-${Date.now()}`;
  }
}
