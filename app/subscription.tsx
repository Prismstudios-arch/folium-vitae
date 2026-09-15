import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Linking, Image, Platform } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { SFSymbol } from "expo-symbols";
import { Radius, Shadow, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { HeroCard } from "@components/HeroCard";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
import { HeaderIconButton } from "@components/ScreenHeader";
import { SUPPORT_EMAIL } from "@constants/config";
import {
  Plan,
  loadPlans,
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
import { selectionFeedback } from "@utils/feedback";

/**
 * Paywall.
 *
 * Built to SPEC §9, which treats these as product requirements:
 *
 *  - Price, period and renewal shown in plain text before a trial starts.
 *  - A close button visible from the first frame.
 *  - No fake countdowns, no fake discounts, no "97% off today only".
 *  - Terms and privacy links present, which Guideline 3.1.2 also requires.
 *  - Every price comes from the store, localised. Nothing is hardcoded.
 *  - Only offer what the subscription actually adds.
 */
export default function SubscriptionScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");

  // On iOS this is a page sheet, which already starts below the status bar.
  // Adding the window's top inset as well left a tall empty band above the
  // close button.
  const topInset = Platform.OS === "ios" ? 0 : insets.top;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [problemDetails, setProblemDetails] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freeLimit, setFreeLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const status = purchasesStatus();

  useEffect(() => {
    void load();

    // The free allowance, from the server that enforces it. Only a free
    // account's limit is the free limit; otherwise the number is left out.
    getApiClient()
      .getQuota()
      .then((quota) => {
        if (quota.plan === "free") setFreeLimit(quota.limit);
      })
      .catch(() => undefined);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const result = await loadPlans();
      setPlans(result.plans);
      setProblem(result.problem);
      setProblemDetails(result.details);

      // Default to the longest period — usually the best value — without
      // hiding the others.
      const preferred =
        result.plans.find((plan) => plan.period === "year") ?? result.plans[0] ?? null;
      setSelectedId(preferred?.packageId ?? null);
    } finally {
      setLoading(false);
    }
  };

  const selected = plans.find((plan) => plan.packageId === selectedId) ?? null;
  const periodText = (plan: Plan) => (plan.period ? ` per ${plan.period}` : "");

  const handlePurchase = async () => {
    if (!selected || purchasing) return;

    setPurchasing(true);
    try {
      const outcome = await purchase(selected.packageId);

      if (outcome.status === "cancelled") return; // Someone who backed out needs no dialog.

      if (outcome.status === "failed") {
        Alert.alert("Not completed", outcome.message ?? "You have not been charged.");
        return;
      }

      // Apply it on the server now, not whenever the webhook lands.
      await syncEntitlementsWithServer();

      // Scheduling can fail or be refused. That must neither swallow the
      // purchase confirmation nor promise a reminder that wasn't set.
      let reminderSet = false;
      if (selected.trial) {
        try {
          const chargeDate = addTrialLength(new Date(), selected.trial.unit, selected.trial.count);
          reminderSet =
            (await scheduleTrialReminder({
              chargeDate,
              priceString: selected.priceString,
              period: selected.period,
            })) !== null;
        } catch (error) {
          console.warn("Couldn't schedule the trial reminder:", error);
        }
      }

      Alert.alert(
        "Welcome to Premium",
        selected.trial
          ? reminderSet
            ? `Your ${selected.trial.duration} trial has started. We'll remind you 2 days before it ends.`
            : `Your ${selected.trial.duration} trial has started. It then renews at ${selected.priceString}${periodText(selected)} unless you cancel before it ends.`
          : "Everything is unlocked.",
        [{ text: "Done", onPress: goBack }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;

    setRestoring(true);
    try {
      const outcome = await restorePurchases();

      if (outcome.status === "failed") {
        Alert.alert("Couldn't restore", outcome.message ?? "Try again in a moment.");
        return;
      }

      if (outcome.activeEntitlements.length === 0) {
        Alert.alert("Nothing to restore", outcome.message ?? "No previous purchases found on this Apple ID.");
        return;
      }

      await syncEntitlementsWithServer();
      Alert.alert("Restored", "Your subscription is active on this phone again.", [{ text: "Done", onPress: goBack }]);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.loose }]} showsVerticalScrollIndicator={false}>
        <HeroCard
          rounded={false}
          contentStyle={[styles.heroContent, { paddingTop: topInset + 76 }]}
          illustrationStyle={{ right: -80, bottom: -20, width: 220, height: 198 }}
        >
          <Image source={require("../assets/brand-mark.png")} style={styles.heroMark} accessibilityIgnoresInvertColors />
          <Text style={styles.heroTitle}>Sorrel Premium</Text>
          <Text style={styles.heroBody}>Everything Sorrel can do,{"\n"}with no daily limit.</Text>
        </HeroCard>

        <View style={styles.sheet}>
          <View style={styles.benefits}>
            <Benefit icon="infinity" color={Tiles.blue} title="Unlimited identifications" detail="No daily limit, ever" />
            <Benefit icon="stethoscope" color={Tiles.teal} title="Plant health checks" detail="Likely causes, and what to try first" last />
          </View>

          <Text style={styles.freeNote}>
            Free keeps working either way —{" "}
            {freeLimit !== null ? `${freeLimit} identifications a day` : "a daily allowance of identifications"}, care
            notes, your collection and reminders.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.brand} style={styles.loader} />
          ) : !status.available ? (
            <Notice title="Not available on this build" body={status.reason} />
          ) : plans.length === 0 ? (
            <Notice
              title="Plans aren't available right now"
              body={`${problem ?? "Couldn't load plans."} You haven't been charged for anything.`}
              details={problemDetails}
              onRetry={load}
            />
          ) : (
            <>
              <View style={styles.plans}>
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.packageId}
                    plan={plan}
                    selected={plan.packageId === selectedId}
                    onPress={() => {
                      if (plan.packageId !== selectedId) selectionFeedback();
                      setSelectedId(plan.packageId);
                    }}
                  />
                ))}
              </View>

              {selected ? (
                <>
                  <Button
                    label={
                      selected.trial
                        ? `Start ${selected.trial.duration} free`
                        : `Subscribe for ${selected.priceString}${periodText(selected)}`
                    }
                    onPress={handlePurchase}
                    loading={purchasing}
                    style={styles.cta}
                  />

                  {/* Full terms before anyone starts, in plain text. SPEC §9. */}
                  <Text style={styles.terms}>
                    {selected.trial
                      ? `${selected.trial.duration} free, then ${selected.trial.thenPrice}${periodText(selected)}. Renews automatically until you cancel. Cancel any time in Settings — if notifications are on, we'll remind you 2 days before the first charge.`
                      : `Renews automatically at ${selected.priceString}${periodText(selected)} until you cancel. Cancel any time in Settings.`}
                  </Text>
                </>
              ) : null}
            </>
          )}

          <View style={styles.links}>
            <Pressable onPress={handleRestore} disabled={restoring} style={styles.linkButton} accessibilityRole="button">
              {restoring ? <ActivityIndicator color={Colors.brand} /> : <Text style={styles.link}>Restore purchases</Text>}
            </Pressable>
            <Pressable onPress={() => Linking.openURL(manageSubscriptionsUrl())} style={styles.linkButton} accessibilityRole="link">
              <Text style={styles.link}>Manage subscription</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>
            Payment is charged to your Apple ID. Subscriptions renew unless cancelled at least 24 hours before the period
            ends. Manage them in your Apple account settings.
          </Text>

          <View style={styles.legalLinks}>
            <Pressable onPress={() => router.push("/terms")} accessibilityRole="button">
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalDivider}>·</Text>
            <Pressable onPress={() => router.push("/privacy")} accessibilityRole="button">
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
            <Text style={styles.legalDivider}>·</Text>
            <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} accessibilityRole="link">
              <Text style={styles.legalLink}>Contact</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Visible from the first frame, top-left, full size. SPEC §9. */}
      <View style={[styles.close, { top: topInset + Spacing.default }]}>
        <HeaderIconButton icon="xmark" label="Close" onPress={goBack} onDark />
      </View>
    </View>
  );
}

function Benefit({
  icon,
  color,
  title,
  detail,
  last = false,
}: {
  icon: SFSymbol;
  color: string;
  title: string;
  detail: string;
  last?: boolean;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.benefit, !last && styles.benefitDivider]}>
      <IconTile icon={icon} color={color} size={36} />
      <View style={styles.benefitText}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDetail}>{detail}</Text>
      </View>
      <Icon name="checkmark" size={15} color={Colors.brand} weight="bold" />
    </View>
  );
}

function PlanCard({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.plan, selected && styles.planSelected, pressed && styles.planPressed]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Icon name="checkmark" size={12} color="#FFFFFF" weight="bold" /> : null}
      </View>

      <View style={styles.planText}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          {plan.trial ? (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>{plan.trial.duration} free</Text>
            </View>
          ) : null}
        </View>
        {plan.description ? <Text style={styles.planDescription}>{plan.description}</Text> : null}
      </View>

      <View style={styles.planPrice}>
        {/* The store's own localised string: what's shown is what's charged. */}
        <Text style={styles.planPriceText}>{plan.priceString}</Text>
        {plan.period ? <Text style={styles.planPeriod}>per {plan.period}</Text> : null}
        {/* Secondary to the amount billed, which stays the prominent figure. */}
        {plan.pricePerMonth ? <Text style={styles.planPeriod}>{plan.pricePerMonth} a month</Text> : null}
      </View>
    </Pressable>
  );
}

function Notice({
  title,
  body,
  details,
  onRetry,
}: {
  title: string;
  body: string;
  /** The store's own error, for whoever is setting the store up. Hidden until asked for. */
  details?: string | null;
  onRetry?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <View style={styles.notice}>
      <IconTile icon="exclamationmark.circle.fill" color={Tiles.amber} size={36} />
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} style={styles.noticeButton} /> : null}
      {details ? (
        showDetails ? (
          <Text style={styles.noticeDetails} selectable>
            {details}
          </Text>
        ) : (
          <Pressable onPress={() => setShowDetails(true)} style={styles.linkButton} accessibilityRole="button">
            <Text style={styles.noticeDetailsToggle}>Show details</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.bg,
    },
    scroll: {
      flexGrow: 1,
    },
    heroContent: {
      paddingBottom: 64,
      paddingHorizontal: Spacing.loose,
    },
    heroMark: {
      width: 64,
      height: 64,
      marginBottom: Spacing.default,
    },
    heroTitle: {
      fontSize: 36,
      lineHeight: 42,
      fontWeight: "800",
      letterSpacing: -0.4,
      color: "#FFFFFF",
    },
    heroBody: {
      ...Typography.bodyLarge,
      lineHeight: 24,
      color: "rgba(255, 255, 255, 0.82)",
      marginTop: Spacing.tight,
    },
    sheet: {
      marginTop: -28,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      backgroundColor: Colors.bg,
      paddingHorizontal: Spacing.default,
      paddingTop: Spacing.loose,
    },
    benefits: {
      backgroundColor: Colors.card,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.default,
      ...Shadow.card,
    },
    benefit: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.default - 4,
      paddingVertical: Spacing.default - 2,
    },
    benefitDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.separator,
    },
    benefitText: {
      flex: 1,
    },
    benefitTitle: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    benefitDetail: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    freeNote: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
      marginVertical: Spacing.default,
      paddingHorizontal: Spacing.tight,
    },
    loader: {
      marginVertical: Spacing.spacious,
    },
    plans: {
      gap: Spacing.tight + 2,
    },
    plan: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.default - 4,
      padding: Spacing.default,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
      borderWidth: 2,
      borderColor: "transparent",
      ...Shadow.card,
    },
    planSelected: {
      borderColor: Colors.brand,
    },
    planPressed: {
      opacity: 0.9,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: Colors.separator,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      backgroundColor: Colors.brand,
      borderColor: Colors.brand,
    },
    planText: {
      flex: 1,
    },
    planTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    planTitle: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    trialBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: Radius.pill,
      backgroundColor: Colors.brandTint,
    },
    trialBadgeText: {
      ...Typography.caption2,
      fontWeight: "700",
      color: Colors.brandDark,
    },
    planDescription: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    planPrice: {
      alignItems: "flex-end",
    },
    planPriceText: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
      fontVariant: ["tabular-nums"],
    },
    planPeriod: {
      ...Typography.caption2,
      color: Colors.textSecondary,
    },
    cta: {
      marginTop: Spacing.loose,
    },
    terms: {
      ...Typography.caption2,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.tight + 2,
      paddingHorizontal: Spacing.tight,
    },
    notice: {
      alignItems: "center",
      padding: Spacing.loose,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
      gap: Spacing.tight,
    },
    noticeTitle: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
      textAlign: "center",
      marginTop: Spacing.tight,
    },
    noticeBody: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    noticeButton: {
      alignSelf: "stretch",
      marginTop: Spacing.tight,
    },
    noticeDetails: {
      ...Typography.caption2,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: Colors.textSecondary,
      alignSelf: "stretch",
      padding: Spacing.default - 4,
      borderRadius: Radius.sm,
      backgroundColor: Colors.fill,
      marginTop: Spacing.tight,
    },
    noticeDetailsToggle: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textDecorationLine: "underline",
    },
    links: {
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.loose,
      marginTop: Spacing.loose,
    },
    linkButton: {
      minHeight: 44,
      justifyContent: "center",
    },
    link: {
      ...Typography.controlSmall,
      color: Colors.brand,
      fontWeight: "600",
    },
    legal: {
      ...Typography.caption2,
      color: Colors.textDisabled,
      textAlign: "center",
      marginTop: Spacing.default,
      paddingHorizontal: Spacing.default,
    },
    legalLinks: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: Spacing.tight,
    },
    legalLink: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textDecorationLine: "underline",
    },
    legalDivider: {
      ...Typography.caption1,
      color: Colors.textDisabled,
      marginHorizontal: Spacing.tight,
    },
    close: {
      position: "absolute",
      left: Spacing.default,
    },
  });
