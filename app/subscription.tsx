import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";

interface Plan {
  id: "free" | "pro" | "premium";
  name: string;
  price: number;
  currency: string;
  interval: string;
  scansPerDay: number | null;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "$",
    interval: "forever",
    scansPerDay: 7,
    features: [
      "7 scans per day",
      "Basic plant database",
      "Care guides",
      "My Plants collection",
      "Ads included",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 4.99,
    currency: "$",
    interval: "month",
    scansPerDay: 50,
    features: [
      "50 scans per day",
      "All basic features",
      "Disease detection",
      "No ads",
      "Email support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 9.99,
    currency: "$",
    interval: "month",
    scansPerDay: null,
    features: [
      "Unlimited scans",
      "All Pro features",
      "Expert escalation",
      "Priority support",
      "Early access to new features",
    ],
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<"free" | "pro" | "premium">("free");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "premium">("pro");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    if (selectedPlan === currentPlan) {
      Alert.alert("Already Subscribed", `You're already on the ${selectedPlan} plan`);
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Integrate with Stripe
      // const result = await stripeBillingClient.startCheckout({
      //   planId: selectedPlan
      // });

      Alert.alert("Success", `Upgraded to ${selectedPlan.toUpperCase()} plan!`);
      setCurrentPlan(selectedPlan);

      // TODO: Navigate back or to success screen
      router.back();
    } catch (error) {
      Alert.alert("Error", "Failed to upgrade plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    if (currentPlan === "free") return;

    Alert.alert(
      "Cancel Subscription",
      `You're about to cancel your ${currentPlan} plan. Your subscription will end at the end of the current billing period.`,
      [
        { text: "Keep Subscription", style: "cancel" },
        {
          text: "Cancel",
          onPress: () => {
            // TODO: Cancel subscription via API
            Alert.alert("Subscription Canceled", "Your plan will end at the end of this billing period.");
            setCurrentPlan("free");
          },
          style: "destructive",
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Your Plan</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Plan Badge */}
        {currentPlan !== "free" && (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.badgeText}>
              ✓ Currently on {currentPlan.toUpperCase()}
            </Text>
          </View>
        )}

        {/* Plans */}
        {PLANS.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              selectedPlan === plan.id && styles.planCardSelected,
              currentPlan === plan.id && styles.planCardCurrent,
            ]}
            onPress={() => setSelectedPlan(plan.id)}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              {plan.id !== "free" && (
                <View style={styles.priceTag}>
                  <Text style={styles.price}>
                    {plan.currency}{plan.price}
                  </Text>
                  <Text style={styles.interval}>/{plan.interval}</Text>
                </View>
              )}
              {plan.id === "free" && (
                <Text style={styles.priceTagFree}>Free Forever</Text>
              )}
            </View>

            {/* Scans Per Day */}
            <View style={styles.scansBadge}>
              <Text style={styles.scansText}>
                {plan.scansPerDay ? `${plan.scansPerDay} scans/day` : "Unlimited scans"}
              </Text>
            </View>

            {/* Features */}
            <View style={styles.features}>
              {plan.features.map((feature, idx) => (
                <View key={idx} style={styles.feature}>
                  <Text style={styles.featureIcon}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Selection Indicator */}
            {selectedPlan === plan.id && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Trust Badge */}
        <View style={styles.trustSection}>
          <Text style={styles.trustEmoji}>🔐</Text>
          <Text style={styles.trustTitle}>Safe & Secure</Text>
          <Text style={styles.trustText}>
            Payments processed securely by Stripe. Cancel anytime, no questions asked.
          </Text>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Questions?</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes! Cancel your subscription anytime in Settings. Your access continues until the end of the billing period.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What if I need a refund?</Text>
            <Text style={styles.faqAnswer}>
              We offer a 7-day money-back guarantee. Email support@verdure.app for help.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Are there annual plans?</Text>
            <Text style={styles.faqAnswer}>
              Yes! Save 20% with annual billing. Contact us at support@verdure.app.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {currentPlan !== "free" && (
          <TouchableOpacity onPress={handleCancelSubscription} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}

        {selectedPlan !== currentPlan && (
          <Button
            label={selectedPlan === "free" ? "Downgrade to Free" : `Upgrade to ${selectedPlan.toUpperCase()}`}
            onPress={handleUpgrade}
            disabled={isLoading}
          />
        )}

        {selectedPlan === currentPlan && currentPlan !== "free" && (
          <View style={styles.currentPlanMessage}>
            <Text style={styles.currentPlanText}>✓ You're on this plan</Text>
          </View>
        )}
      </View>

      {isLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.leaf} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
    paddingBottom: Spacing.loose,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  backButton: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
    marginBottom: Spacing.compact,
  },
  title: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.loose,
  },
  currentPlanBadge: {
    backgroundColor: Colors.leaf,
    paddingVertical: Spacing.compact,
    paddingHorizontal: Spacing.default,
    borderRadius: 8,
    marginBottom: Spacing.default,
  },
  badgeText: {
    fontSize: Typography.caption1.fontSize,
    color: "#FFFFFF",
    fontWeight: "600" as any,
    textAlign: "center",
  },
  planCard: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.default,
    borderWidth: 2,
    borderColor: "transparent",
  },
  planCardSelected: {
    borderColor: Colors.leaf,
    backgroundColor: Colors.background,
  },
  planCardCurrent: {
    borderColor: Colors.leaf,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.default,
  },
  planName: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
  },
  priceTag: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  price: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.leaf,
  },
  interval: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    marginLeft: Spacing.compact,
  },
  priceTagFree: {
    fontSize: Typography.subheadline.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
  },
  scansBadge: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.compact,
    paddingHorizontal: Spacing.default,
    borderRadius: 6,
    marginBottom: Spacing.default,
  },
  scansText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    fontWeight: "600" as any,
    textAlign: "center",
  },
  features: {
    marginBottom: Spacing.default,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.compact,
  },
  featureIcon: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    marginRight: Spacing.compact,
    marginTop: 2,
  },
  featureText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    flex: 1,
  },
  selectedIndicator: {
    backgroundColor: Colors.leaf,
    paddingVertical: Spacing.compact,
    borderRadius: 6,
  },
  selectedText: {
    fontSize: Typography.caption1.fontSize,
    color: "#FFFFFF",
    fontWeight: "600" as any,
    textAlign: "center",
  },
  trustSection: {
    alignItems: "center",
    paddingVertical: Spacing.loose,
    marginVertical: Spacing.loose,
    borderTopWidth: 1,
    borderTopColor: Colors.glass,
  },
  trustEmoji: {
    fontSize: 32,
    marginBottom: Spacing.compact,
  },
  trustTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  trustText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: Spacing.default,
    lineHeight: 20,
  },
  faqSection: {
    paddingVertical: Spacing.loose,
  },
  faqTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  faqItem: {
    marginBottom: Spacing.loose,
  },
  faqQuestion: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600" as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  faqAnswer: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.spacious,
    gap: Spacing.default,
  },
  cancelButton: {
    paddingVertical: Spacing.default,
    alignItems: "center",
  },
  cancelText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    fontWeight: "600" as any,
    textDecorationLine: "underline",
  },
  currentPlanMessage: {
    backgroundColor: Colors.glass,
    paddingVertical: Spacing.default,
    borderRadius: 8,
    alignItems: "center",
  },
  currentPlanText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    fontWeight: "600" as any,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});
