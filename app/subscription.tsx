import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL } from "@constants/config";
import {
  Plan,
  getPlans,
  purchase,
  restorePurchases,
  purchasesStatus,
  manageSubscriptionsUrl,
} from "@services/purchases";
import { scheduleTrialReminder } from "@services/trialReminder";

/**
 * Paywall.
 *
 * Built to SPEC §9, which treats the following as product requirements
 * rather than nice-to-haves:
 *
 *  - Price, period and renewal shown in plain text before a trial starts.
 *  - A close button visible from the first frame. No delay, no tiny grey X.
 *  - No fake countdowns, no fake discounts, no "97% off today only".
 *  - Terms and privacy links present, which Guideline 3.1.2 also requires.
 *  - Every price comes from the store, localised. Nothing is hardcoded.
 */
export default function SubscriptionScreen() {
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const status = purchasesStatus();

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setPlans(await getPlans());
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: Plan) => {
    if (busyPlanId) return;

    setBusyPlanId(plan.packageId);
    try {
      const outcome = await purchase(plan.packageId);

      if (outcome.status === "cancelled") {
        // Deliberately silent. Someone who backed out does not need a dialog.
        return;
      }

      if (outcome.status === "failed") {
        Alert.alert("Not completed", outcome.message ?? "You have not been charged.");
        return;
      }

      // Schedule the warning before the first charge lands.
      if (plan.trial) {
        const chargeDate = addTrialLength(new Date(), plan.trial.duration);
        await scheduleTrialReminder({
          chargeDate,
          priceString: plan.priceString,
          period: plan.period,
        });
      }

      Alert.alert(
        "You're in",
        plan.trial
          ? `Your ${plan.trial.duration} trial has started. We'll remind you 2 days before it converts.`
          : "Thanks — everything is unlocked.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const outcome = await restorePurchases();

      Alert.alert(
        outcome.activeEntitlements.length > 0 ? "Restored" : "Nothing to restore",
        outcome.message ?? "Your subscription is active again."
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Visible from the first frame, top-left, full size. SPEC §9. */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sorrel Premium</Text>
        <Text style={styles.subtitle}>
          Unlimited identifications, disease diagnosis, and the full offline care
          library.
        </Text>

        <View style={styles.freeNote}>
          <Text style={styles.freeNoteText}>
            The free tier keeps working either way — 7 identifications a day, your
            whole collection, and watering reminders. Nothing you already have gets
            taken away.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.leaf} style={styles.loader} />
        ) : !status.available ? (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>Not available yet</Text>
            <Text style={styles.unavailableText}>{status.reason}</Text>
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>Nothing to show</Text>
            <Text style={styles.unavailableText}>
              We couldn't load plans right now. Check your connection and try again —
              you haven't been charged for anything.
            </Text>
            <SecondaryButton label="Try again" onPress={load} style={styles.retry} />
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.packageId} style={styles.planCard}>
              <Text style={styles.planTitle}>{plan.title}</Text>

              {/* The store's own localised string, so what is shown is what is
                  charged, in the user's currency. */}
              <Text style={styles.planPrice}>
                {plan.priceString}
                {plan.period ? <Text style={styles.planPeriod}> per {plan.period}</Text> : null}
              </Text>

              {plan.description ? (
                <Text style={styles.planDescription}>{plan.description}</Text>
              ) : null}

              {/* Full terms before the trial starts, in plain text, not a
                  footnote. SPEC §9. */}
              {plan.trial ? (
                <Text style={styles.trialTerms}>
                  {plan.trial.duration} free, then {plan.trial.thenPrice} per {plan.period}.
                  Renews automatically until you cancel. Cancel any time in Settings —
                  we'll remind you 2 days before the first charge.
                </Text>
              ) : (
                <Text style={styles.trialTerms}>
                  Renews automatically at {plan.priceString} per {plan.period} until you
                  cancel.
                </Text>
              )}

              <Button
                label={plan.trial ? `Start ${plan.trial.duration} free` : `Subscribe`}
                onPress={() => handlePurchase(plan)}
                loading={busyPlanId === plan.packageId}
                disabled={busyPlanId !== null}
                style={styles.planButton}
              />
            </View>
          ))
        )}

        {/* Apple requires a restore path for reinstalls and new devices. */}
        <SecondaryButton
          label="Restore purchases"
          onPress={handleRestore}
          loading={restoring}
          style={styles.restore}
        />

        <TouchableOpacity
          onPress={() => Linking.openURL(manageSubscriptionsUrl())}
          accessibilityRole="link"
        >
          <Text style={styles.manageLink}>Manage or cancel an existing subscription</Text>
        </TouchableOpacity>

        <View style={styles.legal}>
          <Text style={styles.legalText}>
            Payment is charged to your Apple ID. Subscriptions renew unless cancelled
            at least 24 hours before the period ends. Manage them in your Apple
            account settings.
          </Text>

          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => router.push("/terms")} accessibilityRole="button">
              <Text style={styles.legalLink}>Terms of use</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>·</Text>
            <TouchableOpacity onPress={() => router.push("/privacy")} accessibilityRole="button">
              <Text style={styles.legalLink}>Privacy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>·</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              accessibilityRole="link"
            >
              <Text style={styles.legalLink}>Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Work out when the first charge lands from the store's trial description.
 *
 * Parsed rather than assumed, because the trial length is configured in App
 * Store Connect and a hardcoded 7 would quietly become wrong the moment it
 * changed.
 */
function addTrialLength(from: Date, duration: string): Date {
  const match = duration.match(/(\d+)\s*(day|week|month|year)/i);
  const result = new Date(from);

  if (!match) {
    result.setDate(result.getDate() + 7);
    return result;
  }

  const count = Number(match[1]);

  switch (match[2].toLowerCase()) {
    case "day":
      result.setDate(result.getDate() + count);
      break;
    case "week":
      result.setDate(result.getDate() + count * 7);
      break;
    case "month":
      result.setMonth(result.getMonth() + count);
      break;
    case "year":
      result.setFullYear(result.getFullYear() + count);
      break;
  }

  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    paddingTop: Spacing.spacious,
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.tight,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
  content: {
    paddingHorizontal: Spacing.loose,
    paddingBottom: Spacing.extra,
  },
  title: {
    ...Typography.display,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.loose,
  },
  freeNote: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  freeNoteText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  loader: { marginVertical: Spacing.extra },
  unavailable: {
    borderWidth: 1,
    borderColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.loose,
    marginBottom: Spacing.loose,
  },
  unavailableTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  unavailableText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  retry: { marginTop: Spacing.default },
  planCard: {
    borderWidth: 1,
    borderColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.loose,
    marginBottom: Spacing.default,
  },
  planTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  planPrice: {
    ...Typography.displayLarge,
    color: Colors.textPrimary,
    marginTop: Spacing.compact,
  },
  planPeriod: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  planDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  trialTerms: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.default,
    marginBottom: Spacing.default,
  },
  planButton: { marginTop: Spacing.compact },
  restore: { marginTop: Spacing.default },
  manageLink: {
    ...Typography.body,
    color: Colors.leaf,
    textAlign: "center",
    marginTop: Spacing.loose,
  },
  legal: {
    marginTop: Spacing.spacious,
    paddingTop: Spacing.loose,
    borderTopWidth: 1,
    borderTopColor: Colors.glass,
  },
  legalText: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginBottom: Spacing.default,
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  legalLink: {
    ...Typography.caption1,
    color: Colors.leaf,
  },
  legalDivider: {
    ...Typography.caption1,
    color: Colors.textDisabled,
    marginHorizontal: Spacing.tight,
  },
});
