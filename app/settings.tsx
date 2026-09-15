import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, ActivityIndicator, Linking, Image } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Colors, Radius, Spacing, Tiles, Typography } from "@constants/theme";
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
  const router = useRouter();
  const goBack = useGoBack("/");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getUserPreferences()
      .then(setPrefs)
      .catch((error) => console.error("Failed to load preferences:", error));
  }, []);

  const update = async (changes: Partial<UserPreferences>) => {
    if (!prefs) return;
    try {
      await saveUserPreferences(changes);
      setPrefs({ ...prefs, ...changes });
    } catch {
      Alert.alert("Couldn't save", "That setting didn't change. Try again.");
    }
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

      {/* Nothing in the app opened the paywall before, so Premium could not
          be bought — and App Review has to be able to find it. */}
      <Pressable
        onPress={() => router.push("/subscription")}
        style={({ pressed }) => [styles.premium, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Sorrel Premium. Unlimited identifications and plant health checks"
      >
        <HeroCard contentStyle={styles.premiumContent}>
          <View style={styles.premiumRow}>
            <View style={styles.premiumText}>
              <View style={styles.premiumBadge}>
                <Icon name="crown.fill" size={11} color={Colors.brandDeep} />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
              <Text style={styles.premiumTitle}>Unlock everything</Text>
              <Text style={styles.premiumBody}>Unlimited identifications and plant health checks</Text>
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
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
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

const styles = StyleSheet.create({
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
    backgroundColor: Colors.bg,
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
    backgroundColor: Colors.card,
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
});
