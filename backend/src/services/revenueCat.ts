/**
 * RevenueCat Integration Service
 * Phase 2: Subscription management (iOS + Android)
 *
 * RevenueCat handles all payment processing, eliminating need for Stripe
 * Provides cross-platform subscription management
 */

import axios from "axios";
import logger from "../utils/logger";

export interface RevenueCatSubscriber {
  original_app_user_id: string;
  subscriber_attributes?: {
    $email?: string;
    $displayName?: string;
  };
}

export interface RevenueCatEntitlement {
  expires_date: string | null;
  product_identifier: string;
  purchase_date: string;
  original_purchase_date: string;
}

export interface RevenueCatSubscription {
  expires_date: string | null;
  period_type: string;
  purchase_date: string;
  original_purchase_date: string;
}

export const ENTITLEMENTS = {
  PRO: "pro",
  PREMIUM: "premium",
};

export const PLANS = {
  free: {
    name: "Free",
    quotaPerDay: 7,
    features: [
      "7 scans per day",
      "Basic plant database",
      "Care guides",
      "My Plants collection",
    ],
  },
  pro: {
    name: "Pro",
    quotaPerDay: 50,
    features: [
      "50 scans per day",
      "All basic features",
      "Disease detection",
      "No ads",
      "Email support",
    ],
  },
  premium: {
    name: "Premium",
    quotaPerDay: 999999,
    features: [
      "Unlimited scans",
      "All Pro features",
      "Expert escalation",
      "Priority support",
      "Early access to new features",
    ],
  },
};

export class RevenueCatService {
  private apiKey: string;
  private baseUrl = "https://api.revenuecat.com/v1";
  private client = axios.create();

  constructor() {
    this.apiKey = process.env.REVENUECAT_API_KEY || "";

    if (!this.apiKey) {
      logger.warn("REVENUECAT_API_KEY not configured. Subscription features will be unavailable.");
    }

    this.client.defaults.headers.common["Authorization"] = `Bearer ${this.apiKey}`;
    this.client.defaults.headers.common["Content-Type"] = "application/json";
  }

  /**
   * Create or update subscriber in RevenueCat
   */
  async createOrUpdateSubscriber(
    userId: string,
    email?: string,
    displayName?: string
  ): Promise<string> {
    try {
      const response = await this.client.post(
        `${this.baseUrl}/subscribers`,
        {
          app_user_id: userId,
          attributes: {
            $email: email,
            $displayName: displayName,
          },
        }
      );

      logger.info(`RevenueCat subscriber created: ${userId}`);
      return response.data.subscriber.original_app_user_id;
    } catch (error) {
      logger.error("Failed to create RevenueCat subscriber:", error);
      throw error;
    }
  }

  /**
   * Get subscriber info and check entitlements
   */
  async getSubscriber(userId: string) {
    try {
      const response = await this.client.get(
        `${this.baseUrl}/subscribers/${userId}`
      );

      const subscriber = response.data.subscriber;
      const entitlements = subscriber.entitlements || {};
      const subscriptions = subscriber.subscriptions || {};

      // Determine current plan based on entitlements
      let plan = "free";
      if (entitlements[ENTITLEMENTS.PREMIUM]?.expires_date) {
        const expiry = new Date(entitlements[ENTITLEMENTS.PREMIUM].expires_date);
        if (expiry > new Date()) {
          plan = "premium";
        }
      } else if (entitlements[ENTITLEMENTS.PRO]?.expires_date) {
        const expiry = new Date(entitlements[ENTITLEMENTS.PRO].expires_date);
        if (expiry > new Date()) {
          plan = "pro";
        }
      }

      return {
        userId,
        plan,
        entitlements,
        subscriptions,
        isActive: plan !== "free",
      };
    } catch (error) {
      logger.warn(`Failed to get RevenueCat subscriber: ${userId}`, error);
      // Return default (free plan) if lookup fails
      return { userId, plan: "free", entitlements: {}, subscriptions: {} };
    }
  }

  /**
   * Get subscription status for a user
   */
  async getSubscriptionStatus(userId: string): Promise<{
    plan: "free" | "pro" | "premium";
    isActive: boolean;
    expiresAt?: string;
    autoRenew?: boolean;
  }> {
    try {
      const subscriber = await this.getSubscriber(userId);

      return {
        plan: subscriber.plan as any,
        isActive: subscriber.plan !== "free",
        expiresAt: this.getEarliestExpiryDate(subscriber.subscriptions),
        autoRenew: true, // RevenueCat tracks this
      };
    } catch (error) {
      logger.error("Failed to get subscription status:", error);
      return { plan: "free", isActive: false };
    }
  }

  /**
   * Get earliest expiry date from subscriptions
   */
  private getEarliestExpiryDate(subscriptions: Record<string, RevenueCatSubscription>): string | undefined {
    const dates = Object.values(subscriptions)
      .filter((sub) => sub.expires_date)
      .map((sub) => new Date(sub.expires_date!))
      .sort((a, b) => a.getTime() - b.getTime());

    return dates.length > 0 ? dates[0].toISOString() : undefined;
  }

  /**
   * Grant introductory offer
   */
  async grantIntroductoryOffer(userId: string, planId: string): Promise<void> {
    try {
      await this.client.post(
        `${this.baseUrl}/subscribers/${userId}/grant_promotional_entitlement`,
        {
          entitlement_id: planId,
          duration_in_days: 3, // 3-day free trial
        }
      );

      logger.info(`Introductory offer granted: ${userId} -> ${planId}`);
    } catch (error) {
      logger.warn("Failed to grant introductory offer:", error);
    }
  }

  /**
   * Handle webhook events from RevenueCat
   */
  async handleWebhookEvent(event: any): Promise<void> {
    try {
      const { type, app_user_id, entitlements } = event;

      switch (type) {
        case "INITIAL_PURCHASE":
          logger.info(`New subscription: ${app_user_id}`, { entitlements });
          // TODO: Update user plan in database
          break;

        case "RENEWAL":
          logger.info(`Subscription renewed: ${app_user_id}`);
          // TODO: Update renewal date
          break;

        case "CANCELLATION":
          logger.info(`Subscription canceled: ${app_user_id}`);
          // TODO: Mark as canceled
          break;

        case "EXPIRATION":
          logger.info(`Subscription expired: ${app_user_id}`);
          // TODO: Downgrade to free plan
          break;

        case "BILLING_ISSUE":
          logger.warn(`Billing issue: ${app_user_id}`);
          // TODO: Send payment retry notification
          break;

        default:
          logger.debug("Unhandled RevenueCat event:", { type });
      }
    } catch (error) {
      logger.error("Failed to handle RevenueCat webhook:", error);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    // RevenueCat provides signature verification
    // TODO: Implement actual verification using RevenueCat's public key
    return true; // Placeholder
  }

  /**
   * Get customer portal URL (RevenueCat Paywalls)
   */
  async getPaywallUrl(userId: string): Promise<string> {
    try {
      const subscriber = await this.getSubscriber(userId);

      // Return link to RevenueCat Paywalls
      // In production, this would be configured in RevenueCat dashboard
      return `https://rv.revenuecat.com/${process.env.REVENUECAT_APP_ID}/user/${userId}`;
    } catch (error) {
      logger.error("Failed to get paywall URL:", error);
      throw error;
    }
  }
}

export function getRevenueCatService(): RevenueCatService {
  return new RevenueCatService();
}
