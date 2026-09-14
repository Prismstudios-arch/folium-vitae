import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { CareCard } from "@components/CareCard";
import { usePlant } from "@hooks/usePlants";
import { useGoBack } from "@hooks/useGoBack";
import { lookupCareGuide, CareLookupResult } from "@services/careDatabase";
import { Units } from "@services/careFormatting";
import { getUserPreferences } from "@services/userPreferences";
import { cancelWateringReminder } from "@services/wateringReminders";
import { updatePlant, deletePlant } from "@services/database";
import { SavedPlant, getDisplayName } from "@domain/plant";

export default function PlantDetailScreen() {
  const router = useRouter();
  const goBack = useGoBack("/my-plants");
  const params = useLocalSearchParams<{ id?: string }>();
  const plantId = params.id ?? "";

  const { plant, loading, error, reload } = usePlant(plantId);
  const [care, setCare] = useState<CareLookupResult | null>(null);
  const [units, setUnits] = useState<Units>("metric");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<SavedPlant>>({});
  const [saving, setSaving] = useState(false);

  // Coming back from the watering log or the journal must show what was
  // just added. The plant was loaded once on mount, so its history here
  // stayed stale until the screen was closed and reopened.
  useFocusEffect(
    useCallback(() => {
      void reload({ silent: true });
    }, [reload])
  );

  useEffect(() => {
    getUserPreferences()
      .then((prefs) => setUnits(prefs.units))
      .catch(() => {
        // Metric default stands.
      });
  }, []);

  useEffect(() => {
    if (!plant) return;

    setEditData({
      nickname: plant.nickname || "",
      location: plant.location || "",
      notes: plant.notes || "",
    });

    // The lookup result, not just the guide, so the genus-level and
    // unreviewed caveats the result screen shows are shown here too.
    setCare(lookupCareGuide(plant.scientificName));
  }, [plant]);

  const handleSave = async () => {
    if (!plant || saving) return;

    setSaving(true);
    try {
      await updatePlant(plant.id, {
        // Empty strings mean "cleared" — store undefined so the field
        // genuinely empties rather than saving a blank string.
        nickname: editData.nickname?.trim() || undefined,
        location: editData.location?.trim() || undefined,
        notes: editData.notes?.trim() || undefined,
      });

      await reload({ silent: true });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save plant:", err);
      // Stay in edit mode so the user's typing is not thrown away.
      Alert.alert("Couldn't save", "Your changes are still here. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!plant) return;

    Alert.alert(
      "Delete plant",
      `Remove ${getDisplayName(plant)} from your collection? This also removes its photos and watering history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePlant(plant.id);
            } catch (err) {
              console.error("Failed to delete plant:", err);
              // Do not navigate away — leaving the screen would imply it
              // worked, and the plant would still be in the list.
              Alert.alert("Couldn't delete", `${getDisplayName(plant)} is still in your collection.`);
              return;
            }

            // A reminder about a plant that no longer exists would open a
            // "not found" screen.
            await cancelWateringReminder(plant.id).catch(() => undefined);
            goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centred]}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  if (error || !plant) {
    return (
      <View style={[styles.container, styles.centred]}>
        <Text style={styles.errorText}>{error ? "This plant couldn't be loaded." : "Plant not found"}</Text>
        <Button label="Go back" onPress={goBack} style={styles.marginTop} />
      </View>
    );
  }

  const genus = care?.guide.scientificName.split(" ")[0];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIsEditing(!isEditing)}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.editButton}>{isEditing ? "Cancel" : "Edit"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isEditing ? (
          <View style={styles.editableSection}>
            <TextInput
              style={styles.nicknameInput}
              placeholder="Plant nickname"
              value={editData.nickname || ""}
              onChangeText={(text) => setEditData({ ...editData, nickname: text })}
              placeholderTextColor={Colors.textDisabled}
            />
            <Text style={styles.scientificName}>{plant.scientificName}</Text>

            <TextInput
              style={styles.locationInput}
              placeholder="Location (e.g., Living room)"
              value={editData.location || ""}
              onChangeText={(text) => setEditData({ ...editData, location: text })}
              placeholderTextColor={Colors.textDisabled}
            />

            <TextInput
              style={styles.notesInput}
              placeholder="Notes about this plant"
              value={editData.notes || ""}
              onChangeText={(text) => setEditData({ ...editData, notes: text })}
              placeholderTextColor={Colors.textDisabled}
              multiline
              numberOfLines={4}
            />

            <Button
              label="Save changes"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={styles.marginTop}
            />
          </View>
        ) : (
          // Ternaries, not &&: an empty string from the database would render
          // as a bare text node and crash React Native.
          <View style={styles.viewSection}>
            <Text style={styles.nickname}>{getDisplayName(plant)}</Text>
            <Text style={styles.scientificName}>{plant.scientificName}</Text>
            {plant.location ? <Text style={styles.location}>📍 {plant.location}</Text> : null}

            <View style={styles.metaInfo}>
              {plant.acquisitionDate ? (
                <Text style={styles.metaText}>
                  📅 Added {new Date(plant.acquisitionDate).toLocaleDateString()}
                </Text>
              ) : null}
              <Text style={styles.metaText}>
                🔍 Identified {new Date(plant.identificationDate).toLocaleDateString()}
              </Text>
            </View>

            {plant.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{plant.notes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Care guide */}
        {care ? (
          <>
            <Text style={styles.sectionTitle}>Care Guide</Text>
            {care.matchedAt === "genus" ? (
              <Text style={styles.careCaveat}>
                These notes cover the {genus} genus in general, not this exact species.
              </Text>
            ) : null}
            {care.unreviewed ? (
              <Text style={styles.careCaveat}>Not yet reviewed by a horticulturist.</Text>
            ) : null}
            <CareCard guide={care.guide} compactMode={true} units={units} />
          </>
        ) : (
          <View style={styles.noCareGuide}>
            <Text style={styles.noCareGuideText}>No care notes for this plant yet</Text>
            <Text style={styles.noCareGuideSubtext}>
              We'd rather show nothing than guess. More plants are being added.
            </Text>
          </View>
        )}

        {/* Water log */}
        <View style={styles.waterLogSection}>
          <Text style={styles.sectionTitle}>Water Log</Text>
          {plant.waterLogs.length === 0 ? (
            <Text style={styles.emptyText}>No watering records yet</Text>
          ) : (
            plant.waterLogs.slice(0, 5).map((log) => (
              <View key={log.id} style={styles.logEntry}>
                <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString()}</Text>
                {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
              </View>
            ))
          )}
          <Button
            label="Log watering"
            onPress={() =>
              router.push({
                pathname: "/water-log",
                params: { plantId: plant.id, plantName: getDisplayName(plant) },
              })
            }
            variant="secondary"
            style={styles.marginTop}
          />
        </View>

        <View style={styles.section}>
          <Button
            label="Photo journal"
            onPress={() =>
              router.push({
                pathname: "/photo-journal",
                params: { plantId: plant.id, plantName: getDisplayName(plant) },
              })
            }
            variant="secondary"
          />
        </View>

        {/* Nothing linked to the health check, so it could never be reached. */}
        <View style={styles.section}>
          <Button
            label="Check plant health"
            onPress={() =>
              router.push({
                pathname: "/disease-detection",
                params: { plantId: plant.id, plantName: getDisplayName(plant) },
              })
            }
            variant="secondary"
          />
        </View>

        <View style={styles.dangerZone}>
          <Button label="Delete plant" onPress={handleDelete} style={styles.deleteButton} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centred: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  backButton: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600",
  },
  editButton: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.spacious,
  },
  editableSection: {
    backgroundColor: Colors.glass,
    borderRadius: 8,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  viewSection: {
    marginBottom: Spacing.loose,
  },
  nicknameInput: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
    padding: 0,
  },
  locationInput: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginTop: Spacing.default,
    marginBottom: Spacing.default,
    paddingVertical: Spacing.tight,
    borderBottomColor: Colors.leaf,
    borderBottomWidth: 1,
  },
  notesInput: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginTop: Spacing.default,
    borderColor: Colors.leaf,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.tight,
    minHeight: 100,
    textAlignVertical: "top",
  },
  nickname: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  scientificName: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginBottom: Spacing.default,
  },
  location: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  metaInfo: {
    backgroundColor: Colors.glass,
    borderRadius: 8,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  metaText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
  },
  notesBox: {
    backgroundColor: Colors.glass,
    borderRadius: 8,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  notesLabel: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  notesText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
    marginTop: Spacing.loose,
  },
  careCaveat: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  noCareGuide: {
    backgroundColor: Colors.glass,
    borderRadius: 8,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
    alignItems: "center",
  },
  noCareGuideText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  noCareGuideSubtext: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
    textAlign: "center",
  },
  waterLogSection: {
    marginTop: Spacing.loose,
    marginBottom: Spacing.loose,
  },
  logEntry: {
    paddingVertical: Spacing.default,
    borderBottomColor: Colors.glass,
    borderBottomWidth: 1,
  },
  logDate: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  logNotes: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginTop: Spacing.compact,
  },
  emptyText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.default,
  },
  section: {
    marginBottom: Spacing.default,
  },
  dangerZone: {
    marginTop: Spacing.spacious,
    paddingTop: Spacing.loose,
    borderTopColor: Colors.error,
    borderTopWidth: 1,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  marginTop: {
    marginTop: Spacing.default,
  },
  errorText: {
    fontSize: Typography.body.fontSize,
    color: Colors.error,
    textAlign: "center",
  },
});
