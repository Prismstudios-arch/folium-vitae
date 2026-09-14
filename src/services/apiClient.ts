/**
 * Client for the Sorrel API.
 *
 * All identification goes through this client to our own server, never
 * straight to the vision provider — that is what keeps the provider key off
 * the device (SPEC 6).
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, DEFAULT_TIMEOUT_MS, IDENTIFY_TIMEOUT_MS } from "@constants/config";
import { IdentificationImage, IdentificationResult, Species } from "@domain/plant";

const TOKEN_STORAGE_KEY = "sorrel_auth_tokens";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

export interface PublicUser {
  id: string;
  email: string | null;
  displayName: string;
  plan: "free" | "pro" | "premium";
  isAnonymous: boolean;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  plan: "free" | "pro" | "premium";
  resetsAt: string;
}

export interface IdentifyResponse extends IdentificationResult {
  cached: boolean;
  quota?: QuotaState;
}

export interface DiseaseFinding {
  id: string;
  name: string;
  /** Raw provider probability, 0-1. */
  probability: number;
  description?: string;
  treatment?: { prevention?: string[]; chemical?: string[]; biological?: string[] };
}

export interface DiagnosisResponse {
  isHealthy: boolean;
  healthyProbability: number;
  diseases: DiseaseFinding[];
  provider: string;
  timestamp: string;
  cached: boolean;
}

/**
 * Machine-readable reasons the server attaches to some errors, so the app
 * can offer the right next step instead of pattern-matching prose.
 */
export const ErrorCode = {
  DailyLimit: "DAILY_LIMIT",
  PremiumRequired: "PREMIUM_REQUIRED",
} as const;

/** Error carrying the server's message so the UI can show something true. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: { message?: string; code?: string } }>;
    const status = axiosError.response?.status ?? 0;
    const serverMessage = axiosError.response?.data?.error?.message;
    const code = axiosError.response?.data?.error?.code;

    if (status === 0 || axiosError.code === "ECONNABORTED") {
      return new ApiError("Can't reach the server. Check your connection.", 0, true);
    }

    // 5xx and 429 are usually worth retrying — except a spent daily
    // allowance, which no retry fixes before midnight. Marking that
    // retryable put people in a "Try again" loop that could not succeed.
    const retryable = code !== ErrorCode.DailyLimit && (status >= 500 || status === 429);

    return new ApiError(serverMessage ?? "Something went wrong.", status, retryable, code);
  }

  return new ApiError("Something went wrong.", 0, false);
}

export class ApiClient {
  private client: AxiosInstance;
  private tokens: AuthTokens | null = null;
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(baseUrl: string = API_URL) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: DEFAULT_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });

    this.client.interceptors.request.use((config) => {
      if (this.tokens) {
        config.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

        // Refresh once per request. Without the _retried guard a persistently
        // rejecting token loops until the stack blows.
        if (error.response?.status === 401 && original && !original._retried && this.tokens) {
          original._retried = true;

          if (await this.refreshTokens()) {
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${this.tokens!.accessToken}`;
            return this.client(original);
          }

          await this.clearTokens();
        }

        return Promise.reject(error);
      }
    );
  }

  // MARK: - Session

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    this.tokens = tokens;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }

  private async clearTokens(): Promise<void> {
    this.tokens = null;
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  /**
   * Collapse concurrent refreshes into one. Several requests failing at once
   * would otherwise each start a refresh, and all but one would be rejected
   * for reusing a rotated token.
   */
  private async refreshTokens(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      try {
        const { data } = await axios.post<AuthTokens>(
          `${this.client.defaults.baseURL}/api/auth/refresh`,
          { refreshToken: this.tokens?.refreshToken }
        );
        await this.storeTokens(data);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  async restoreSession(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (!stored) return false;
      this.tokens = JSON.parse(stored) as AuthTokens;
      return true;
    } catch {
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  getUserId(): string | null {
    return this.tokens?.userId ?? null;
  }

  // MARK: - Auth

  /** Device-keyed sign-in. No account, no password, no PII (SPEC 9). */
  async loginAnonymous(deviceId: string): Promise<PublicUser> {
    try {
      const { data } = await this.client.post<AuthTokens & { user: PublicUser }>(
        "/api/auth/login-anonymous",
        { deviceId }
      );
      await this.storeTokens(data);
      return data.user;
    } catch (error) {
      throw toApiError(error);
    }
  }

  async register(email: string, password: string, displayName: string): Promise<PublicUser> {
    try {
      const { data } = await this.client.post<AuthTokens & { user: PublicUser }>(
        "/api/auth/register",
        { email, password, displayName }
      );
      await this.storeTokens(data);
      return data.user;
    } catch (error) {
      throw toApiError(error);
    }
  }

  async login(email: string, password: string): Promise<PublicUser> {
    try {
      const { data } = await this.client.post<AuthTokens & { user: PublicUser }>(
        "/api/auth/login",
        { email, password }
      );
      await this.storeTokens(data);
      return data.user;
    } catch (error) {
      throw toApiError(error);
    }
  }

  async logout(): Promise<void> {
    await this.clearTokens();
  }

  /**
   * Permanently delete this account and everything the server holds for it —
   * identification history and subscription records included.
   *
   * The privacy policy promises that Delete in Settings removes account data.
   * It previously cleared this phone only, and the server kept everything.
   */
  async deleteAccount(): Promise<void> {
    try {
      await this.client.delete("/api/auth/me");
    } catch (error) {
      throw toApiError(error);
    }

    await this.clearTokens();
  }

  // MARK: - Subscriptions

  /**
   * Ask the server to re-read this account's entitlements now.
   *
   * The server fetches them from RevenueCat with its secret key — the app
   * only says "look now", it never says what was bought (SPEC §6). This
   * exists because webhooks can lag, and someone who has just paid should
   * not be told Premium is locked.
   */
  async syncSubscription(): Promise<{ plan: PublicUser["plan"] }> {
    try {
      const { data } = await this.client.post<{ plan: PublicUser["plan"] }>(
        "/api/subscriptions/sync"
      );
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  }

  // MARK: - Identification

  /**
   * Identify a plant via our proxy.
   *
   * The server holds the provider key, enforces quota, and answers from cache
   * when it has seen this image hash before. It returns an error rather than
   * a fabricated result when the provider is unavailable.
   */
  async identify(
    images: IdentificationImage[],
    imageHash: string
  ): Promise<IdentifyResponse> {
    const payload = images.map((image) => ({
      base64: image.base64,
      organ: image.organ,
    }));

    try {
      const { data } = await this.client.post<IdentifyResponse>(
        "/api/identify",
        { images: payload, imageHash },
        { timeout: IDENTIFY_TIMEOUT_MS }
      );

      // Dates cross the wire as strings.
      return { ...data, timestamp: new Date(data.timestamp) };
    } catch (error) {
      throw toApiError(error);
    }
  }

  /**
   * Assess a plant's health.
   *
   * Premium only — the server enforces that and answers 403 with
   * PREMIUM_REQUIRED.
   */
  async diagnose(
    images: IdentificationImage[],
    imageHash: string,
    plantId?: string
  ): Promise<DiagnosisResponse> {
    const payload = images.map((image) => ({ base64: image.base64 }));

    try {
      const { data } = await this.client.post<DiagnosisResponse>(
        "/api/diagnose",
        { images: payload, imageHash, plantId },
        { timeout: IDENTIFY_TIMEOUT_MS }
      );
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  }

  async getIdentificationHistory(): Promise<
    Array<{ id: string; candidates: Species[]; identified_at: string }>
  > {
    try {
      const { data } = await this.client.get<{
        identifications: Array<{ id: string; candidates: Species[]; identified_at: string }>;
      }>("/api/identify/history");
      return data.identifications;
    } catch (error) {
      throw toApiError(error);
    }
  }

  // MARK: - Quota

  async getQuota(): Promise<QuotaState> {
    const userId = this.getUserId();
    if (!userId) throw new ApiError("Not signed in", 401, false);

    try {
      const { data } = await this.client.get<QuotaState>(`/api/quota/${userId}`);
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  }

  // MARK: - Health

  async isReachable(): Promise<boolean> {
    try {
      const { status } = await this.client.get("/health", { timeout: 5000 });
      return status === 200;
    } catch {
      return false;
    }
  }
}

let instance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!instance) instance = new ApiClient();
  return instance;
}
