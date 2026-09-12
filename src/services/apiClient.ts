/**
 * API Client
 * Phase 2: Communication with Verdure backend
 * Handles authentication, sync, and data operations
 */

import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private authToken: AuthToken | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  constructor(baseUrl: string = process.env.VERDURE_API_URL || "http://localhost:3000") {
    this.baseUrl = baseUrl;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          if (this.authToken) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
              // Retry original request
              return this.client(error.config);
            }
          }
          // Clear auth if refresh fails
          this.clearAuth();
        }
        return Promise.reject(error);
      }
    );
  }

  // MARK: - Authentication

  /**
   * Register a new user
   */
  async register(email: string, password: string, displayName: string) {
    try {
      const response = await this.client.post<ApiResponse<AuthToken>>("/api/auth/register", {
        email,
        password,
        displayName,
      });

      if (response.data.data) {
        await this.setAuthToken(response.data.data);
        return response.data.data;
      }

      throw new Error("Registration failed");
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Login with email/password
   */
  async login(email: string, password: string) {
    try {
      const response = await this.client.post<ApiResponse<AuthToken>>("/api/auth/login", {
        email,
        password,
      });

      if (response.data.data) {
        await this.setAuthToken(response.data.data);
        return response.data.data;
      }

      throw new Error("Login failed");
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Login anonymously (device-based)
   */
  async loginAnonymous(deviceId: string) {
    try {
      const response = await this.client.post<ApiResponse<AuthToken>>(
        "/api/auth/login-anonymous",
        { deviceId }
      );

      if (response.data.data) {
        await this.setAuthToken(response.data.data);
        return response.data.data;
      }

      throw new Error("Anonymous login failed");
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Refresh access token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      if (!this.authToken) return false;

      const response = await this.client.post<ApiResponse<AuthToken>>(
        "/api/auth/refresh",
        { refreshToken: this.authToken.refreshToken }
      );

      if (response.data.data) {
        await this.setAuthToken(response.data.data);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return false;
    }
  }

  /**
   * Store auth token and schedule refresh
   */
  private async setAuthToken(token: AuthToken) {
    this.authToken = token;
    await AsyncStorage.setItem("verdure_auth_token", JSON.stringify(token));

    // Schedule token refresh before expiration
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    const refreshIn = (token.expiresIn - 300) * 1000; // Refresh 5 min before expiry
    this.tokenRefreshTimer = setTimeout(() => this.refreshToken(), refreshIn);
  }

  /**
   * Clear auth token
   */
  private async clearAuth() {
    this.authToken = null;
    await AsyncStorage.removeItem("verdure_auth_token");

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
  }

  // MARK: - Preferences

  /**
   * Get user preferences from server
   */
  async getPreferences(userId: string) {
    try {
      const response = await this.client.get(`/api/preferences/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update user preferences on server
   */
  async updatePreferences(userId: string, preferences: any) {
    try {
      const response = await this.client.post(`/api/preferences/${userId}`, preferences);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Sync preferences (delta sync)
   */
  async syncPreferences(userId: string, lastSync?: string) {
    try {
      const response = await this.client.get(`/api/preferences/${userId}/sync`, {
        params: { lastSync },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // MARK: - Quota

  /**
   * Get current quota for user
   */
  async getQuota(userId: string) {
    try {
      const response = await this.client.get(`/api/quota/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Consume one scan credit
   */
  async consumeQuota(userId: string) {
    try {
      const response = await this.client.post(`/api/quota/${userId}/consume`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Upgrade user plan
   */
  async upgradePlan(userId: string, planType: "pro" | "premium", paymentMethodId: string) {
    try {
      const response = await this.client.post(`/api/quota/${userId}/upgrade`, {
        planType,
        paymentMethodId,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // MARK: - Plants

  /**
   * Get user's plant collection
   */
  async getPlants(userId: string) {
    try {
      const response = await this.client.get(`/api/plants/${userId}`);
      return response.data.plants;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new plant
   */
  async createPlant(userId: string, plantData: any) {
    try {
      const response = await this.client.post(`/api/plants/${userId}`, plantData);
      return response.data.plant;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Upload photo for plant
   */
  async uploadPlantPhoto(userId: string, plantId: string, photoData: any) {
    try {
      const response = await this.client.post(
        `/api/plants/${userId}/${plantId}/photos`,
        photoData
      );
      return response.data.photo;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Detect disease from plant photo
   */
  async detectDisease(userId: string, plantId: string, imageBase64: string) {
    try {
      const response = await this.client.post(
        `/api/plants/${userId}/${plantId}/detect-disease`,
        { imageBase64 }
      );
      return response.data.diagnosis;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create expert escalation ticket
   */
  async requestExpertHelp(userId: string, plantId: string, question: string, photoUrl?: string) {
    try {
      const response = await this.client.post(
        `/api/plants/${userId}/${plantId}/expert-escalation`,
        { question, photoUrl }
      );
      return response.data.ticket;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // MARK: - Notifications

  /**
   * Register device for push notifications
   */
  async registerForNotifications(userId: string, deviceToken: string, platform: "ios" | "android") {
    try {
      const response = await this.client.post("/api/notifications/subscribe", {
        userId,
        deviceToken,
        platform,
      });
      return response.data.subscription;
    } catch (error) {
      console.warn("Failed to register for notifications:", error);
      // Don't throw - notifications are optional
    }
  }

  /**
   * Schedule watering reminder for plant
   */
  async scheduleWateringReminder(
    userId: string,
    plantId: string,
    frequency: string,
    nextWateringDate: string
  ) {
    try {
      const response = await this.client.post(
        "/api/notifications/schedule-watering-reminder",
        { userId, plantId, frequency, nextWateringDate }
      );
      return response.data.reminder;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // MARK: - Utilities

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.authToken?.userId || null;
  }

  /**
   * Restore auth token from storage
   */
  async restoreAuth(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem("verdure_auth_token");
      if (stored) {
        this.authToken = JSON.parse(stored);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to restore auth:", error);
      return false;
    }
  }

  /**
   * Logout and clear auth
   */
  async logout() {
    await this.clearAuth();
  }

  /**
   * Handle API errors
   */
  private handleError(error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;

      if (status === 401) {
        return new Error("Unauthorized. Please log in again.");
      } else if (status === 429) {
        return new Error("Rate limited. Please wait before trying again.");
      } else if (status === 404) {
        return new Error("Resource not found.");
      } else if (status === 500) {
        return new Error("Server error. Please try again later.");
      }

      return new Error(message || "API request failed");
    }

    return error;
  }
}

// Singleton instance
let apiClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClient) {
    apiClient = new ApiClient();
  }
  return apiClient;
}
