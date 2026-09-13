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
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { CareCard } from "@components/CareCard";
import { usePlant } from "@hooks/usePlants";
import { getCareGuide } from "@services/careDatabase";
import { SavedPlant, CareGuide, getDisplayName } from "@domain/plant";

export default function PlantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const plantId = params.id as string;

  const { plant, loading, error } = usePlant(plantId);
  const [careGuide, setCareGuide] = useState<CareGuide | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<SavedPlant>>({});

  useEffect(() => {
    if (plant) {
      setEditData({
        nickname: plant.nickname || "",
        location: plant.location || "",
        notes: plant.notes || "",
      });

      // Load care guide
      const guide = getCareGuide(plant.scientificName);
      setCareGuide(guide);
    }
  }, [plant]);

  const handleSave = () => {
    // TODO: Save changes
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert("Delete Plant", `Remove ${plant ? getDisplayName(plant) : "this plant"} from your collection?`, [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Delete",
        onPress: () => {
          // TODO: Delete plant
          router.back();
        },
        style: "destructive",
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.leaf} />
      </View>
    );
  }

  if (error || !plant) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error?.message || "Plant not found"}</Text>
        <Button label="Go Back" onPress={() => router.back()} style={styles.marginTop} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <Text style={styles.editButton}>{isEditing ? "Done" : "Edit"}</Text>
        </TouchableOpacity>
      </View>

      {/* Plant Info */}
      <View style={styles.content}>
        {isEditing ? (
          <EditableSection>
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

            <Button label="Save Changes" onPress={handleSave} style={styles.marginTop} />
          </EditableSection>
        ) : (
          <ViewSection>
            <Text style={styles.nickname}>{getDisplayName(plant)}</Text>
            <Text style={styles.scientificName}>{plant.scientificName}</Text>
            {plant.location && <Text style={styles.location}>📍 {plant.location}</Text>}

            <View style={styles.metaInfo}>
              {plant.acquisitionDate && (
                <Text style={styles.metaText}>
                  📅 Added {new Date(plant.acquisitionDate).toLocaleDateString()}
                </Text>
              )}
              {plant.identificationDate && (
                <Text style={styles.metaText}>
                  🔍 Identified {new Date(plant.identificationDate).toLocaleDateString()}
                </Text>
              )}
            </View>

            {plant.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{plant.notes}</Text>
              </View>
            )}
          </ViewSection>
        )}

        {/* Care Guide */}
        {careGuide ? (
          <>
            <Text style={styles.sectionTitle}>Care Guide</Text>
            <CareCard guide={careGuide} compactMode={true} />
          </>
        ) : (
          <View style={styles.noCareGuide}>
            <Text style={styles.noCareGuideText}>No specific care guide available yet</Text>
            <Text style={styles.noCareGuideSubtext}>
              We're working on adding care information for more plants
            </Text>
          </View>
        )}

        {/* Water Log */}
        <View style={styles.waterLogSection}>
          <Text style={styles.sectionTitle}>Water Log</Text>
          {plant.waterLogs.length === 0 ? (
            <Text style={styles.emptyText}>No watering records yet</Text>
          ) : (
            plant.waterLogs.slice(0, 5).map((log) => (
              <View key={log.id} style={styles.logEntry}>
                <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString()}</Text>
                {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
              </View>
            ))
          )}
          <Button label="Log Watering" onPress={() => {}} variant="secondary" style={styles.marginTop} />
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Button label="Delete Plant" onPress={handleDelete} style={styles.deleteButton} />
        </View>
      </View>
    </ScrollView>
  );
}

function EditableSection({ children }: { children: React.ReactNode }) {
  return <View style={styles.editableSection}>{children}</View>;
}

function ViewSection({ children }: { children: React.ReactNode }) {
  return <View style={styles.viewSection}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  backButton: {
    fontSize: 24,
    color: Colors.leaf,
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
    paddingVertical: Spacing.tight,
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
    color: Colors.textDisabled,
    textAlign: "center",
    paddingVertical: Spacing.default,
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
