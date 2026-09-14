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
import { SUPPORT_EMAIL } from "@constants/config";
import {
  Plan,
  getPlans,
  purchase,
  restorePurchases,
  purchasesStatus,
  manageSubscriptionsUrl,
  syncEntitlementsWithServer,
} from "@services/purchases";
import { addTrialLength } from "@services/subscriptionTerms";
import { scheduleTrialReminder } from "@services/trialReminder";
import { getApiClient } from "@services/apiClient";
import { useGoBack } from "@hooks/useGoBack";

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
 *
 * And one this screen used to break: only offer what the subscription
 * actually adds. It advertised "the full offline care library" — which free
 * users already see, and which holds a handful of plants.
 */
export default function SubscriptionScreen() {
  const router = useRouter();
  const goBack = useGoBack("/");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [freeLimit, setFreeLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const status = purchasesStatus();

  useEffect(() => {
    void load();

    // The free allowance, from the server that enforces it — a hardcoded
    // "7" here would quietly go wrong the day the limit changes. Only a free
    // account's limit is the free limit; otherwise the number is left out.
    getApiClient()
      .getQuota()
      .then((quota) => {
        if (quota.plan === "free") setFreeLimit(quota.limit);
      })
      .catch(() => {
        // Offline. The sentence reads fine without a number.
      });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setPlans(await getPlans());
    } finally {
      setLoading(false);
    }
  };

  const periodText = (plan: Plan) => (plan.period ? ` per ${plan.period}` : "");

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

      // Apply it on the server now, not whenever the webhook lands —
      // otherwise the first Premium feature opened after paying could still
      // say it's locked.
      await syncEntitlementsWithServer();

      // Scheduling can fail, or be refused. That must neither swallow the
      // confirmation of a purchase that went through, nor let the message
      // promise a reminder that wasn't set.
      let reminderSet = false;
      if (plan.trial) {
        try {
          const chargeDate = addTrialLength(new Date(), plan.trial.unit, plan.trial.count);
          reminderSet =
            (await scheduleTrialReminder({
              chargeDate,
              priceString: plan.priceString,
              period: plan.period,
            })) !== null;
        } catch (error) {
          console.warn("Couldn't schedule the trial reminder:", error);
        }
      }

      Alert.alert(
        "You're in",
        plan.trial
          ? reminderSet
            ? `Your ${plan.trial.duration} trial has started. We'll remind you 2 days before it ends.`
            : `Your ${plan.trial.duration} trial has started. It then renews at ${plan.priceString}${periodText(plan)} unless you cancel before it ends.`
          : "Thanks — Premium is unlocked.",
        [{ text: "Done", onPress: goBack }]
      );
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;

    setRestoring(true);
    try {
      const outcome = await restorePurchases();

      // A failure used to be titled "Nothing to restore", and finding
      // nothing came with "Your subscription is active again".
      if (outcome.status === "failed") {
        Alert.alert("Couldn't restore", outcome.message ?? "Try again in a moment.");
        return;
      }

      if (outcome.activeEntitlements.length === 0) {
        Alert.alert(
          "Nothing to restore",
          outcome.message ?? "No previous purchases found on this Apple ID."
        );
        return;
      }

      await syncEntitlementsWithServer();
      Alert.alert("Restored", "Your subscription is active on this phone again.", [
        { text: "Done", onPress: goBack },
      ]);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Visible from the first frame, top-left, full size. SPEC §9. */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goBack}
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
          Unlimited identifications, plus health checks that suggest what's wrong with a plant and
          what to try first.
        </Text>

        <View style={styles.freeNote}>
          <Text style={styles.freeNoteText}>
            The free tier keeps working either way —{" "}
            {freeLimit !== null
              ? `${freeLimit} identifications a day`
              : "a daily allowance of identifications"}
            , care notes, your whole collection and watering reminders. Nothing you already have
            gets taken away.
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
              We couldn't load plans right now. Check your connection and try again — you haven't
              been charged for anything.
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
                  {plan.trial.duration} free, then {plan.trial.thenPrice}
                  {periodText(plan)}. Renews automatically until you cancel. Cancel any time in
                  Settings — if notifications are on, we'll remind you 2 days before the first
                  charge.
                </Text>
              ) : (
                <Text style={styles.trialTerms}>
                  Renews automatically at {plan.priceString}
                  {periodText(plan)} until you cancel.
                </Text>
              )}

              <Button
                label={plan.trial ? `Start ${plan.trial.duration} free` : "Subscribe"}
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
            Payment is charged to your Apple ID. Subscriptions renew unless cancelled at least 24
            hours before the period ends. Manage them in your Apple account settings.
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    paddingTop: Spacing.default,
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
