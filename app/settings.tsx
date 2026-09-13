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
import { Colors, Spacing, Typography } from "@constants/theme";
import { SUPPORT_EMAIL, MANAGE_SUBSCRIPTION_URL } from "@constants/config";
import { Button } from "@components/Button";
import {
  getUserPreferences,
  saveUserPreferences,
  exportUserData,
  resetAllData,
  UserPreferences,
} from "@services/userPreferences";

export default function SettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const loaded = await getUserPreferences();
      setPrefs(loaded);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const handleUnitsChange = async (units: "metric" | "imperial") => {
    if (!prefs) return;
    try {
      await saveUserPreferences({ units });
      setPrefs({ ...prefs, units });
    } catch (error) {
      Alert.alert("Error", "Failed to save preferences");
    }
  };

  const handleHemisphereChange = async (hemisphere: "north" | "south") => {
    if (!prefs) return;
    try {
      await saveUserPreferences({ hemisphere });
      setPrefs({ ...prefs, hemisphere });
    } catch (error) {
      Alert.alert("Error", "Failed to save preferences");
    }
  };

  const handleToggleToxicityWarnings = async (value: boolean) => {
    if (!prefs) return;
    try {
      await saveUserPreferences({ showToxicityWarnings: value });
      setPrefs({ ...prefs, showToxicityWarnings: value });
    } catch (error) {
      Alert.alert("Error", "Failed to save preferences");
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (!prefs) return;
    try {
      await saveUserPreferences({ notificationsEnabled: value });
      setPrefs({ ...prefs, notificationsEnabled: value });
    } catch (error) {
      Alert.alert("Error", "Failed to save preferences");
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const data = await exportUserData();
      await Share.share({
        message: data,
        title: "Sorrel Data Export",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to export data");
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = () => {
    Alert.alert(
      "Delete All Data",
      "This will permanently delete all your plants and preferences. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await resetAllData();
              // Reset local state
              await loadPreferences();
              Alert.alert("Success", "All data has been deleted");
            } catch (error) {
              Alert.alert("Error", "Failed to delete data");
            } finally {
              setLoading(false);
            }
          },
        },
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        {/* Units */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Measurement Units</Text>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleOption, prefs.units === "metric" && styles.toggleOptionActive]}
              onPress={() => handleUnitsChange("metric")}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  prefs.units === "metric" && styles.toggleOptionTextActive,
                ]}
              >
                Metric
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, prefs.units === "imperial" && styles.toggleOptionActive]}
              onPress={() => handleUnitsChange("imperial")}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  prefs.units === "imperial" && styles.toggleOptionTextActive,
                ]}
              >
                Imperial
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hemisphere */}
        <View style={styles.settingGroup}>
          <Text style={styles.settingLabel}>Growing Hemisphere</Text>
          <Text style={styles.settingDescription}>
            Helps us show seasonal care advice
          </Text>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleOption, prefs.hemisphere === "north" && styles.toggleOptionActive]}
              onPress={() => handleHemisphereChange("north")}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  prefs.hemisphere === "north" && styles.toggleOptionTextActive,
                ]}
              >
                Northern
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, prefs.hemisphere === "south" && styles.toggleOptionActive]}
              onPress={() => handleHemisphereChange("south")}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  prefs.hemisphere === "south" && styles.toggleOptionTextActive,
                ]}
              >
                Southern
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Safety</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Show Toxicity Warnings</Text>
            <Text style={styles.settingDescription}>
              Highlight plants toxic to kids and pets
            </Text>
          </View>
          <Switch
            value={prefs.showToxicityWarnings}
            onValueChange={handleToggleToxicityWarnings}
            trackColor={{ false: Colors.glass, true: Colors.leafLight }}
            thumbColor={prefs.showToxicityWarnings ? Colors.leaf : Colors.textDisabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Watering Reminders</Text>
            <Text style={styles.settingDescription}>
              Get notified when your plants need water
            </Text>
          </View>
          <Switch
            value={prefs.notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: Colors.glass, true: Colors.leafLight }}
            thumbColor={prefs.notificationsEnabled ? Colors.leaf : Colors.textDisabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>

        <TouchableOpacity style={styles.dataButton} onPress={handleExportData} disabled={loading}>
          <Text style={styles.dataButtonText}>📥 Export My Data</Text>
          <Text style={styles.dataButtonDescription}>
            Download your plants and preferences as JSON
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dataButton} onPress={handleResetData} disabled={loading}>
          <Text style={styles.dataButtonText}>🗑️ Delete All Data</Text>
          <Text style={styles.dataButtonDescription}>
            Permanently delete all plants and preferences
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

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

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Build</Text>
          <Text style={styles.aboutValue}>Phase 1</Text>
        </View>

        <Text style={styles.aboutText}>
          Sorrel is built with honesty in mind. We never fake confidence, never trap you
          in subscriptions, and never give you bad advice.
        </Text>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back to Home</Text>
        </TouchableOpacity>
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
  section: {
    marginBottom: Spacing.spacious,
    paddingHorizontal: Spacing.default,
  },
  sectionTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginTop: Spacing.spacious,
    marginBottom: Spacing.default,
  },
  settingGroup: {
    marginBottom: Spacing.spacious,
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
  dataButtonDescription: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
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
  backLink: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
    marginTop: Spacing.default,
  },
  spacer: {
    height: Spacing.spacious,
  },
});
