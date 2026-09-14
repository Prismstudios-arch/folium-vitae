import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Colors, Spacing, Typography } from "@constants/theme";
import { SUPPORT_EMAIL, MANAGE_SUBSCRIPTION_URL } from "@constants/config";
import {
  getUserPreferences,
  saveUserPreferences,
  UserPreferences,
} from "@services/userPreferences";
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
    void loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setPrefs(await getUserPreferences());
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

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
   * The reminders switch used to save a value that nothing read. Turning it
   * on now asks for notification permission — at the moment the reason is
   * obvious — and schedules reminders for every plant with enough history.
   */
  const handleToggleReminders = async (value: boolean) => {
    if (!prefs || busy) return;

    if (value) {
      const permission = await requestReminderPermission();

      if (!permission.granted) {
        if (permission.canAskAgain) {
          Alert.alert(
            "Reminders need notifications",
            "Sorrel can't remind you without permission to send notifications."
          );
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
      await Share.share({
        message: await exportEverything(),
        title: "Sorrel data export",
      });
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
        Alert.alert(
          "Nothing to restore",
          outcome.message ?? "No previous purchases found on this Apple ID."
        );
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
            {
              text: "Delete from this phone",
              style: "destructive",
              onPress: () => void runDelete(true),
            },
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* The only way out used to be a link at the very bottom of the page. */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        {/* Nothing in the app opened the paywall, so Premium could not be
            bought — and App Review has to be able to find it. */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/subscription")}
          accessibilityRole="button"
        >
          <Text style={styles.linkLabel}>Sorrel Premium</Text>
          <Text style={styles.linkHint}>Unlimited identifications and plant health checks</Text>
        </TouchableOpacity>

        {/* SPEC §5 lists Restore purchases in Settings; it was only on the
            paywall. */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleRestore}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.linkLabel}>Restore purchases</Text>
          <Text style={styles.linkHint}>After reinstalling or moving to a new phone</Text>
        </TouchableOpacity>

        {/* Top-level and deep-linked to Apple's own page, per SPEC §9. Making
            someone hunt for how to cancel is the dark pattern this product
            is positioned against. */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          accessibilityRole="link"
        >
          <Text style={styles.linkLabel}>Manage subscription</Text>
          <Text style={styles.linkHint}>Opens Apple's subscription settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() =>
            Alert.alert(
              "How to cancel",
              "Tap Manage subscription above. That opens Apple's page, where you " +
                "pick Sorrel and tap Cancel Subscription.\n\n" +
                "You keep access until the period you have paid for ends.\n\n" +
                "Stuck? Email us and we'll walk you through it."
            )
          }
          accessibilityRole="button"
        >
          <Text style={styles.linkLabel}>How do I cancel?</Text>
          <Text style={styles.linkHint}>A straight answer, in two taps</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Measurement units</Text>
          {/* Nothing read this before; care cards now show temperatures in it. */}
          <Text style={styles.settingDescription}>Used for temperatures in care notes</Text>
          <View style={styles.toggleGroup}>
            {(["metric", "imperial"] as const).map((units) => (
              <TouchableOpacity
                key={units}
                style={[styles.toggleOption, prefs.units === units && styles.toggleOptionActive]}
                onPress={() => update({ units })}
                accessibilityRole="button"
                accessibilityState={{ selected: prefs.units === units }}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    prefs.units === units && styles.toggleOptionTextActive,
                  ]}
                >
                  {units === "metric" ? "Metric (°C)" : "Imperial (°F)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Growing hemisphere</Text>
          {/* It claimed to drive seasonal advice while nothing read it. The
              watering log now uses it to say which season your plants are in. */}
          <Text style={styles.settingDescription}>
            Used to work out which season your plants are in
          </Text>
          <View style={styles.toggleGroup}>
            {(["north", "south"] as const).map((hemisphere) => (
              <TouchableOpacity
                key={hemisphere}
                style={[
                  styles.toggleOption,
                  prefs.hemisphere === hemisphere && styles.toggleOptionActive,
                ]}
                onPress={() => update({ hemisphere })}
                accessibilityRole="button"
                accessibilityState={{ selected: prefs.hemisphere === hemisphere }}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    prefs.hemisphere === hemisphere && styles.toggleOptionTextActive,
                  ]}
                >
                  {hemisphere === "north" ? "Northern" : "Southern"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Safety</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Show toxicity warnings</Text>
            <Text style={styles.settingDescription}>
              Warn when an identified plant is toxic to people or pets
            </Text>
          </View>
          <Switch
            value={prefs.showToxicityWarnings}
            onValueChange={(value) => update({ showToxicityWarnings: value })}
            trackColor={{ false: Colors.glass, true: Colors.leafLight }}
            thumbColor={prefs.showToxicityWarnings ? Colors.leaf : Colors.textDisabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Watering reminders</Text>
            <Text style={styles.settingDescription}>
              A nudge to check a plant when it's usually due, based on your own watering log
            </Text>
          </View>
          <Switch
            value={prefs.notificationsEnabled}
            onValueChange={handleToggleReminders}
            disabled={busy}
            trackColor={{ false: Colors.glass, true: Colors.leafLight }}
            thumbColor={prefs.notificationsEnabled ? Colors.leaf : Colors.textDisabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your data</Text>

        <TouchableOpacity style={styles.dataButton} onPress={handleExportData} disabled={busy}>
          <Text style={styles.dataButtonText}>Export my data</Text>
          <Text style={styles.dataButtonDescription}>
            Your plants, settings and identification history, as a file you can share
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dataButton} onPress={handleDeleteAll} disabled={busy}>
          <Text style={[styles.dataButtonText, styles.destructive]}>Delete all data</Text>
          <Text style={styles.dataButtonDescription}>
            Removes everything from this phone and your account from our server
          </Text>
        </TouchableOpacity>

        {busy ? <ActivityIndicator color={Colors.leaf} style={styles.busy} /> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal & support</Text>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/privacy")}
          accessibilityRole="button"
        >
          <Text style={styles.linkLabel}>Privacy</Text>
          <Text style={styles.linkHint}>What we collect, and what we don't</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/terms")}
          accessibilityRole="button"
        >
          <Text style={styles.linkLabel}>Terms of use</Text>
          <Text style={styles.linkHint}>Including what an identification is worth</Text>
        </TouchableOpacity>

        {/* A real address, not a contact form (SPEC §5). */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accessibilityRole="link"
        >
          <Text style={styles.linkLabel}>Contact us</Text>
          <Text style={styles.linkHint}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        {/* Read from the app config. The hardcoded "1.0.0" and "Build: Phase 1"
            would have been wrong from the second release. */}
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>{Constants.expoConfig?.version ?? "—"}</Text>
        </View>

        {/* "Never give you bad advice" was a promise no plant app can keep. */}
        <Text style={styles.aboutText}>
          Sorrel tells you when it isn't sure, shows you the other possibilities, and never makes
          it hard to cancel.
        </Text>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
  },
  backLink: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
    marginBottom: Spacing.compact,
  },
  screenTitle: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: Spacing.default,
    paddingHorizontal: Spacing.default,
  },
  sectionTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginTop: Spacing.loose,
    marginBottom: Spacing.default,
  },
  settingGroup: {
    marginBottom: Spacing.default,
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
  },
  settingLabel: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  settingDescription: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.default,
  },
  toggleGroup: {
    flexDirection: "row",
    gap: Spacing.compact,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.compact,
    paddingHorizontal: Spacing.default,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.glass,
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  toggleOptionActive: {
    backgroundColor: Colors.leaf,
    borderColor: Colors.leaf,
  },
  toggleOptionText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
  },
  toggleOptionTextActive: {
    color: "#FFFFFF",
    fontWeight: "600" as any,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.default,
    paddingHorizontal: Spacing.default,
    backgroundColor: Colors.glass,
    borderRadius: 12,
    marginBottom: Spacing.default,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.default,
  },
  dataButton: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.default,
  },
  dataButtonText: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  destructive: {
    color: Colors.error,
  },
  dataButtonDescription: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
  },
  busy: {
    marginTop: Spacing.compact,
  },
  linkRow: {
    paddingVertical: Spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  linkLabel: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  linkHint: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.compact,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
    marginBottom: Spacing.compact,
  },
  aboutLabel: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  aboutValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600" as any,
    color: Colors.textPrimary,
  },
  aboutText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginVertical: Spacing.default,
  },
  spacer: {
    height: Spacing.spacious,
  },
});
