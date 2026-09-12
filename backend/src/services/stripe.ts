/**
 * Stripe Payment Service
 * Phase 2: Plan subscriptions, one-time purchases
 */

import Stripe from "stripe";
import logger from "../utils/logger";

export interface Plan {
  id: string;
  name: string;
  amount: number; // in cents
  currency: string;
  interval: "month" | "year";
  quotaPerDay: number;
  features: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: "active" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt?: string;
  createdAt: string;
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: "free",
    name: "Free",
    amount: 0,
    currency: "USD",
    interval: "month",
    quotaPerDay: 7,
    features: [
      "7 scans per day",
      "Basic plant database",
      "Care guides",
      "My Plants collection",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    amount: 499, // $4.99/month
    currency: "USD",
    interval: "month",
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
    id: "premium",
    name: "Premium",
    amount: 999, // $9.99/month
    currency: "USD",
    interval: "month",
    quotaPerDay: 999999, // Unlimited
    features: [
      "Unlimited scans",
      "All Pro features",
      "Expert escalation",
      "Priority support",
      "Early access to new features",
    ],
  },
};

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      logger.warn("STRIPE_SECRET_KEY not configured. Payments disabled.");
    }

    this.stripe = new Stripe(apiKey || "sk_test_dummy", {
      apiVersion: "2023-10-16",
    });
  }

  /**
   * Create Stripe customer for user
   */
  async createCustomer(userId: string, email: string, name?: string) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name: name || email,
        metadata: {
          verdureUserId: userId,
        },
      });

      return customer.id;
    } catch (error) {
      logger.error("Failed to create Stripe customer:", error);
      throw error;
    }
  }

  /**
   * Create subscription for user
   */
  async createSubscription(
    customerId: string,
    planId: "pro" | "premium",
    paymentMethodId: string
  ) {
    try {
      const plan = PLANS[planId];
      if (!plan || plan.amount === 0) {
        throw new Error("Invalid plan for subscription");
      }

      // Get or create price in Stripe
      const priceId = await this.getPriceId(planId);

      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_method: paymentMethodId,
        off_session: true,
        default_payment_method: paymentMethodId,
        expand: ["latest_invoice.payment_intent"],
      });

      return {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };
    } catch (error) {
      logger.error("Failed to create subscription:", error);
      throw error;
    }
  }

  /**
   * Get or create price ID for plan
   */
  private async getPriceId(planId: string): Promise<string> {
    // In production, store Stripe price IDs in config or database
    // For now, use test mode price IDs
    const priceIds: Record<string, string> = {
      pro: process.env.STRIPE_PRO_PRICE_ID || "price_pro_test",
      premium: process.env.STRIPE_PREMIUM_PRICE_ID || "price_premium_test",
    };

    return priceIds[planId] || "";
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediate: boolean = false) {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: !immediate,
        }
      );

      return {
        status: subscription.status,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        willCancelAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : null,
      };
    } catch (error) {
      logger.error("Failed to cancel subscription:", error);
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        subscriptionId
      );

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
      };
    } catch (error) {
      logger.error("Failed to get subscription:", error);
      throw error;
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhookEvent(event: Stripe.Event) {
    try {
      switch (event.type) {
        case "customer.subscription.created":
          logger.info("Subscription created", {
            subscriptionId: (event.data.object as any).id,
          });
          break;

        case "customer.subscription.updated":
          logger.info("Subscription updated", {
            subscriptionId: (event.data.object as any).id,
          });
          break;

        case "customer.subscription.deleted":
          logger.info("Subscription canceled", {
            subscriptionId: (event.data.object as any).id,
          });
          break;

        case "invoice.payment_succeeded":
          logger.info("Payment succeeded", {
            invoiceId: (event.data.object as any).id,
          });
          // TODO: Update subscription status in database
          break;

        case "invoice.payment_failed":
          logger.warn("Payment failed", {
            invoiceId: (event.data.object as any).id,
          });
          // TODO: Notify user of failed payment
          break;

        default:
          logger.debug("Unhandled webhook event", { type: event.type });
      }
    } catch (error) {
      logger.error("Failed to handle webhook event:", error);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    body: string | Buffer,
    signature: string
  ): Stripe.Event | null {
    try {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        logger.warn("STRIPE_WEBHOOK_SECRET not configured");
        return null;
      }

      return this.stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error) {
      logger.error("Webhook signature verification failed:", error);
      return null;
    }
  }
}

export function getStripeService(): StripeService {
  return new StripeService();
}
