import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, ActivityIndicator, Linking, Image } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { getApiClient, QuotaState } from "@services/apiClient";
import Constants from "expo-constants";
import {
  AppearancePreference,
  BrandColors,
  DarkColors,
  LightColors,
  Radius,
  Spacing,
  Tiles,
  Typography,
  type Palette,
} from "@constants/theme";
import { selectionFeedback } from "@utils/feedback";
import { useColors, useTheme, useThemedStyles } from "@hooks/useTheme";
import { SUPPORT_EMAIL, MANAGE_SUBSCRIPTION_URL } from "@constants/config";
import { HeroCard } from "@components/HeroCard";
import { Icon } from "@components/Icon";
import { ListGroup, ListRow, ListSwitchRow } from "@components/ListGroup";
import { ScreenHeader } from "@components/ScreenHeader";
import { getUserPreferences, saveUserPreferences, UserPreferences } from "@services/userPreferences";
import { exportEverything, deleteEverything, ServerDeletionError } from "@services/accountData";
import { restorePurchases, syncEntitlementsWithServer } from "@services/purchases";
import {
  requestReminderPermission,
  refreshAllWateringReminders,
  cancelAllWateringReminders,
} from "@services/wateringReminders";
import { useGoBack } from "@hooks/useGoBack";

export default function SettingsScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useGoBack("/");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const { preference, setPreference } = useTheme();
  const [plan, setPlan] = useState<QuotaState["plan"] | null>(null);
  const isPremium = plan !== null && plan !== "free";

  useEffect(() => {
    getUserPreferences()
      .then(setPrefs)
      .catch((error) => console.error("Failed to load preferences:", error));
  }, []);

  // From the server, which decides the plan. Refreshed whenever Settings is
  // shown, so coming back from the paywall after buying shows Premium.
  const refreshPlan = useCallback(() => {
    getApiClient()
      .getQuota()
      .then((quota) => setPlan(quota.plan))
      .catch(() => undefined);
  }, []);

  useFocusEffect(refreshPlan);

  const update = async (changes: Partial<UserPreferences>): Promise<boolean> => {
    if (!prefs) return false;
    try {
      await saveUserPreferences(changes);
      setPrefs((current) => (current ? { ...current, ...changes } : current));
      return true;
    } catch {
      Alert.alert("Couldn't save", "That setting didn't change. Try again.");
      return false;
    }
  };

  /** Applied at once so the choice can be seen, and put back if it couldn't be saved. */
  const handleAppearance = async (appearance: AppearancePreference) => {
    const previous = preference;
    setPreference(appearance);
    if (!(await update({ appearance }))) setPreference(previous);
  };

  /**
   * Turning reminders on asks for notification permission — at the moment
   * the reason is obvious — and schedules reminders for every plant with
   * enough history.
   */
  const handleToggleReminders = async (value: boolean) => {
    if (!prefs || busy) return;

    if (value) {
      const permission = await requestReminderPermission();

      if (!permission.granted) {
        if (permission.canAskAgain) {
          Alert.alert("Reminders need notifications", "Sorrel can't remind you without permission to send notifications.");
        } else {
          Alert.alert(
            "Notifications are off",
            "Notifications are turned off for Sorrel. Turn them on in your phone's Settings, then switch reminders on here.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ]
          );
        }
        return;
      }
    }

    await update({ notificationsEnabled: value });

    try {
      if (value) {
        await refreshAllWateringReminders();
      } else {
        await cancelAllWateringReminders();
      }
    } catch (error) {
      console.warn("Couldn't update watering reminders:", error);
    }
  };

  const handleExportData = async () => {
    setBusy(true);
    try {
      await Share.share({ message: await exportEverything(), title: "Sorrel data export" });
    } catch {
      Alert.alert("Couldn't export", "Your data couldn't be gathered just now. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;

    setBusy(true);
    try {
      const outcome = await restorePurchases();

      if (outcome.status === "failed") {
        Alert.alert("Couldn't restore", outcome.message ?? "Try again in a moment.");
      } else if (outcome.activeEntitlements.length === 0) {
        Alert.alert("Nothing to restore", outcome.message ?? "No previous purchases found on this Apple ID.");
      } else {
        await syncEntitlementsWithServer();
        refreshPlan();
        Alert.alert("Restored", "Your subscription is active on this phone again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async (localOnly: boolean) => {
    setBusy(true);
    try {
      await deleteEverything({ localOnly });

      Alert.alert(
        localOnly ? "Deleted from this phone" : "Everything deleted",
        localOnly
          ? "Your plants, photos and settings are gone from this phone. Your account is still on our server — delete again when you're online to remove it."
          : "Your plants, photos, settings and account have been deleted.",
        [{ text: "OK", onPress: () => router.replace("/onboarding") }]
      );
    } catch (error) {
      if (error instanceof ServerDeletionError) {
        Alert.alert(
          "Couldn't reach the server",
          "Nothing has been deleted. Try again when you're online, or clear this phone now and remove your account later.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete from this phone", style: "destructive", onPress: () => void runDelete(true) },
          ]
        );
      } else {
        Alert.alert(
          "Couldn't finish deleting",
          "Something went wrong part-way through. Try again — anything already deleted stays deleted."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      "Delete all data",
      "This permanently deletes your plants, photos and watering history from this phone, and your account and identification history from our server. It can't be undone.\n\n" +
        "It doesn't cancel a subscription — only Apple can, from Manage subscription.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void runDelete(false) },
      ]
    );
  };

  if (!prefs) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader onBack={goBack} backLabel="Home" title="Settings" />

      {/* App Review has to be able to find the paywall from here. A
          subscriber gets their plan and Apple's management page instead of
          being offered what they already pay for. */}
      <Pressable
        onPress={() => (isPremium ? void Linking.openURL(MANAGE_SUBSCRIPTION_URL) : router.push("/subscription"))}
        style={({ pressed }) => [styles.premium, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          isPremium
            ? "You're on Sorrel Premium. Manage subscription"
            : "Sorrel Premium. Unlimited identifications and plant health checks"
        }
      >
        <HeroCard contentStyle={styles.premiumContent}>
          <View style={styles.premiumRow}>
            <View style={styles.premiumText}>
              <View style={styles.premiumBadge}>
                <Icon name="crown.fill" size={11} color={Colors.brandDeep} />
                <Text style={styles.premiumBadgeText}>{isPremium ? "Active" : "Premium"}</Text>
              </View>
              <Text style={styles.premiumTitle}>{isPremium ? "You're on Premium" : "Unlock everything"}</Text>
              <Text style={styles.premiumBody}>
                {isPremium
                  ? "Unlimited identifications and health checks. Tap to manage."
                  : "Unlimited identifications and plant health checks"}
              </Text>
            </View>
            <Icon name="chevron.right" size={16} color="#FFFFFF" weight="semibold" />
          </View>
        </HeroCard>
      </Pressable>

      <ListGroup title="Subscription">
        <ListRow icon="arrow.clockwise" tint={Tiles.blue} title="Restore purchases" onPress={handleRestore} disabled={busy} />
        <ListRow
          icon="creditcard.fill"
          tint={Tiles.green}
          title="Manage subscription"
          onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
        />
        <ListRow
          icon="questionmark"
          tint={Tiles.grey}
          title="How do I cancel?"
          onPress={() =>
            Alert.alert(
              "How to cancel",
              "Tap Manage subscription. That opens Apple's page, where you pick Sorrel and tap Cancel Subscription.\n\n" +
                "You keep access until the period you have paid for ends.\n\n" +
                "Stuck? Email us and we'll walk you through it."
            )
          }
        />
      </ListGroup>

      <ListGroup title="Appearance">
        <AppearancePicker value={preference} onChange={handleAppearance} />
      </ListGroup>

      <ListGroup title="Preferences" footer="Units set temperatures in care notes. Hemisphere works out which season your plants are in.">
        <ListRow
          icon="thermometer.medium"
          tint={Tiles.orange}
          title="Units"
          accessory={
            <Segmented
              options={[
                { value: "metric", label: "°C" },
                { value: "imperial", label: "°F" },
              ]}
              value={prefs.units}
              onChange={(units) => update({ units })}
            />
          }
        />
        <ListRow
          icon="globe.europe.africa.fill"
          tint={Tiles.teal}
          title="Hemisphere"
          accessory={
            <Segmented
              options={[
                { value: "north", label: "North" },
                { value: "south", label: "South" },
              ]}
              value={prefs.hemisphere}
              onChange={(hemisphere) => update({ hemisphere })}
            />
          }
        />
      </ListGroup>

      <ListGroup title="Safety and reminders">
        <ListSwitchRow
          icon="exclamationmark.triangle.fill"
          tint={Tiles.amber}
          title="Toxicity warnings"
          subtitle="When a plant is toxic to people or pets"
          value={prefs.showToxicityWarnings}
          onValueChange={(value) => update({ showToxicityWarnings: value })}
        />
        <ListSwitchRow
          icon="bell.fill"
          tint={Tiles.red}
          title="Watering reminders"
          subtitle="Based on your own watering log"
          value={prefs.notificationsEnabled}
          onValueChange={handleToggleReminders}
          disabled={busy}
        />
      </ListGroup>

      <ListGroup title="Your data">
        <ListRow
          icon="square.and.arrow.up"
          tint={Tiles.blue}
          title="Export my data"
          subtitle="Plants, settings and identification history"
          onPress={handleExportData}
          disabled={busy}
        />
        <ListRow
          icon="trash.fill"
          title="Delete all data"
          subtitle="From this phone and our server"
          onPress={handleDeleteAll}
          disabled={busy}
          destructive
        />
      </ListGroup>

      <ListGroup title="Legal and support">
        <ListRow icon="hand.raised.fill" tint={Tiles.blue} title="Privacy" onPress={() => router.push("/privacy")} />
        <ListRow icon="doc.text.fill" tint={Tiles.grey} title="Terms of use" onPress={() => router.push("/terms")} />
        <ListRow
          icon="envelope.fill"
          tint={Tiles.green}
          title="Contact us"
          subtitle={SUPPORT_EMAIL}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </ListGroup>

      {/* The version comes from the app config; the old hardcoded "1.0.0"
          and "Build: Phase 1" would have been wrong from the second release.
          The text wraps: the old line ran off the right edge of the screen. */}
      <View style={styles.footer}>
        <Image source={require("../assets/brand-mark.png")} style={styles.footerMark} accessibilityIgnoresInvertColors />
        <Text style={styles.footerName}>Sorrel {Constants.expoConfig?.version ?? ""}</Text>
        <Text style={styles.footerText}>
          Tells you when it isn't sure, shows you the other possibilities, and never makes it hard
          to cancel.
        </Text>
      </View>

      {busy ? <ActivityIndicator color={Colors.brand} style={styles.busy} /> : null}
    </ScrollView>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              selectionFeedback();
              onChange(option.value);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const APPEARANCES: Array<{ value: AppearancePreference; label: string; accessibilityLabel: string }> = [
  { value: "system", label: "Automatic", accessibilityLabel: "Automatic, matches your phone" },
  { value: "light", label: "Light", accessibilityLabel: "Light" },
  { value: "dark", label: "Dark", accessibilityLabel: "Dark" },
];

const PREVIEW_WIDTH = 64;
const PREVIEW_HEIGHT = 92;

/** Three miniature screens, the way iOS offers Light and Dark in Display & Brightness. */
function AppearancePicker({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (value: AppearancePreference) => void;
}) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.appearance} accessibilityRole="radiogroup">
      {APPEARANCES.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              selectionFeedback();
              onChange(option.value);
            }}
            style={({ pressed }) => [styles.appearanceOption, pressed && styles.appearancePressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.accessibilityLabel}
          >
            <View style={[styles.preview, selected && styles.previewSelected]}>
              {option.value === "system" ? (
                // Half light, half dark: it follows the phone.
                <>
                  <View style={styles.previewHalf}>
                    <MiniScreen palette={LightColors} />
                  </View>
                  <View style={styles.previewHalf}>
                    <MiniScreen palette={DarkColors} rightHalf />
                  </View>
                </>
              ) : (
                <MiniScreen palette={option.value === "dark" ? DarkColors : LightColors} />
              )}
            </View>
            <Text style={[styles.appearanceLabel, selected && styles.appearanceLabelSelected]}>{option.label}</Text>
            <Icon
              name={selected ? "checkmark.circle.fill" : "circle"}
              size={20}
              color={selected ? Colors.brand : Colors.textDisabled}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tiny screen drawn in one palette: the emerald hero, then two list rows. */
function MiniScreen({ palette, rightHalf = false }: { palette: Palette; rightHalf?: boolean }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.mini, { backgroundColor: palette.bg, left: rightHalf ? -PREVIEW_WIDTH / 2 : 0 }]}>
      <View style={[styles.miniHero, { backgroundColor: BrandColors.brandLit }]} />
      {[palette.brand, Tiles.blue].map((tile) => (
        <View key={tile} style={[styles.miniRow, { backgroundColor: palette.card }]}>
          <View style={[styles.miniTile, { backgroundColor: tile }]} />
          <View style={[styles.miniLine, { backgroundColor: palette.separator }]} />
        </View>
      ))}
    </View>
  );
}

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.bg,
    },
    content: {
      paddingBottom: Spacing.extra,
    },
    loading: {
      flex: 1,
      backgroundColor: Colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    premium: {
      marginHorizontal: Spacing.default,
      marginBottom: Spacing.loose,
    },
    pressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    premiumContent: {
      paddingVertical: Spacing.loose,
    },
    premiumRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    premiumText: {
      flex: 1,
      paddingRight: 110,
    },
    premiumBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.pill,
      backgroundColor: Colors.brandBright,
    },
    premiumBadgeText: {
      ...Typography.caption2,
      fontWeight: "700",
      color: Colors.brandDeep,
    },
    premiumTitle: {
      ...Typography.headline,
      color: "#FFFFFF",
      marginTop: Spacing.tight,
    },
    premiumBody: {
      ...Typography.caption1,
      color: "rgba(255, 255, 255, 0.8)",
      marginTop: 2,
    },
    segmented: {
      flexDirection: "row",
      padding: 2,
      borderRadius: 9,
      backgroundColor: Colors.fill,
    },
    segment: {
      minWidth: 56,
      height: 30,
      paddingHorizontal: Spacing.tight,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentSelected: {
      backgroundColor: Colors.elevated,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    segmentText: {
      ...Typography.caption1,
      fontWeight: "500",
      color: Colors.textSecondary,
    },
    segmentTextSelected: {
      color: Colors.textPrimary,
      fontWeight: "600",
    },
    footer: {
      alignItems: "center",
      paddingHorizontal: Spacing.spacious,
      marginTop: Spacing.default,
      gap: Spacing.tight,
    },
    footerMark: {
      width: 44,
      height: 44,
    },
    footerName: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    footerText: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    busy: {
      marginTop: Spacing.default,
    },
    appearance: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: Spacing.default,
      paddingHorizontal: Spacing.tight,
    },
    appearanceOption: {
      alignItems: "center",
      gap: Spacing.tight,
      minWidth: 80,
    },
    appearancePressed: {
      opacity: 0.7,
    },
    preview: {
      width: PREVIEW_WIDTH + 4,
      height: PREVIEW_HEIGHT + 4,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: Colors.separator,
      overflow: "hidden",
      flexDirection: "row",
    },
    previewSelected: {
      borderColor: Colors.brand,
    },
    previewHalf: {
      width: PREVIEW_WIDTH / 2,
      height: PREVIEW_HEIGHT,
      overflow: "hidden",
    },
    mini: {
      position: "absolute",
      top: 0,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      padding: 6,
      gap: 5,
    },
    miniHero: {
      height: 28,
      borderRadius: 5,
    },
    miniRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 19,
      paddingHorizontal: 5,
      borderRadius: 4,
    },
    miniTile: {
      width: 8,
      height: 8,
      borderRadius: 2,
    },
    miniLine: {
      flex: 1,
      height: 3,
      borderRadius: 2,
    },
    appearanceLabel: {
      ...Typography.caption1,
      color: Colors.textSecondary,
    },
    appearanceLabelSelected: {
      color: Colors.textPrimary,
      fontWeight: "600",
    },
  });
