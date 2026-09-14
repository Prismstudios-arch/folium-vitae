import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { CareCard } from "@components/CareCard";
import { Icon } from "@components/Icon";
import { ScreenHeader } from "@components/ScreenHeader";
import { usePlant } from "@hooks/usePlants";
import { useGoBack } from "@hooks/useGoBack";
import { lookupCareGuide, CareLookupResult } from "@services/careDatabase";
import { Units } from "@services/careFormatting";
import { getUserPreferences } from "@services/userPreferences";
import { cancelWateringReminder } from "@services/wateringReminders";
import { updatePlant, deletePlant } from "@services/database";
import { SavedPlant, getDisplayName, getMostRecentPhoto } from "@domain/plant";

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
      `Delete ${getDisplayName(plant)}?`,
      "This also removes its photos and watering history. It can't be undone.",
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
      <View style={styles.container}>
        <ScreenHeader onBack={goBack} backLabel="My Plants" />
        <View style={styles.centred}>
          <Text style={styles.stateTitle}>
            {error ? "This plant couldn't be loaded" : "This plant isn't in your collection"}
          </Text>
          <Button label="Back to My Plants" onPress={goBack} style={styles.stateButton} />
        </View>
      </View>
    );
  }

  const cover = getMostRecentPhoto(plant);
  const genus = care?.guide.scientificName.split(" ")[0];
  const openWithPlant = (pathname: "/water-log" | "/photo-journal" | "/disease-detection") =>
    router.push({ pathname, params: { plantId: plant.id, plantName: getDisplayName(plant) } });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <ScreenHeader
        onBack={goBack}
        backLabel="My Plants"
        right={
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={styles.editToggle}
            accessibilityRole="button"
          >
            <Text style={styles.editToggleText}>{isEditing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        }
      />

      {/* DESIGN.md: the photo is the hero. The plant's own photo leads. */}
      {cover && !isEditing ? (
        <Image source={{ uri: cover.imagePath }} style={styles.cover} resizeMode="cover" />
      ) : null}

      <View style={styles.content}>
        {isEditing ? (
          <View style={styles.editor}>
            <Text style={styles.fieldLabel}>Nickname</Text>
            <TextInput
              style={styles.field}
              placeholder={plant.commonNames[0] ?? plant.scientificName}
              value={editData.nickname || ""}
              onChangeText={(text) => setEditData({ ...editData, nickname: text })}
              placeholderTextColor={Colors.textDisabled}
            />

            <Text style={styles.fieldLabel}>Where it lives</Text>
            <TextInput
              style={styles.field}
              placeholder="e.g. Living room windowsill"
              value={editData.location || ""}
              onChangeText={(text) => setEditData({ ...editData, location: text })}
              placeholderTextColor={Colors.textDisabled}
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.field, styles.fieldMultiline]}
              placeholder="Anything worth remembering"
              value={editData.notes || ""}
              onChangeText={(text) => setEditData({ ...editData, notes: text })}
              placeholderTextColor={Colors.textDisabled}
              multiline
            />

            <Button
              label="Save changes"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            />
          </View>
        ) : (
          // Ternaries, not &&: an empty string from the database would render
          // as a bare text node and crash React Native.
          <View>
            <Text style={styles.name}>{getDisplayName(plant)}</Text>
            <Text style={styles.scientificName}>{plant.scientificName}</Text>

            <View style={styles.facts}>
              {plant.location ? <Fact icon="mappin.and.ellipse" text={plant.location} /> : null}
              <Fact
                icon="camera.viewfinder"
                text={`Identified ${new Date(plant.identificationDate).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
              />
            </View>

            {plant.notes ? <Text style={styles.notes}>{plant.notes}</Text> : null}
          </View>
        )}

        {/* Everything you can do with this plant, as rows rather than three
            stacked grey buttons. */}
        <View style={styles.actions}>
          <ActionRow
            icon="drop.fill"
            title="Watering log"
            detail={
              plant.waterLogs.length === 0
                ? "Nothing logged yet"
                : `Last watered ${new Date(plant.waterLogs[0].date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}`
            }
            onPress={() => openWithPlant("/water-log")}
          />
          <ActionRow
            icon="photo.stack"
            title="Photo journal"
            detail={
              plant.photos.length === 0
                ? "No photos yet"
                : `${plant.photos.length} photo${plant.photos.length === 1 ? "" : "s"}`
            }
            onPress={() => openWithPlant("/photo-journal")}
          />
          <ActionRow
            icon="stethoscope"
            title="Check plant health"
            detail="Photograph a leaf that looks wrong"
            onPress={() => openWithPlant("/disease-detection")}
            last
          />
        </View>

        <Text style={styles.sectionTitle}>Care</Text>
        {care ? (
          <>
            {care.matchedAt === "genus" ? (
              <Text style={styles.caveat}>
                These notes cover the {genus} genus in general, not this exact species.
              </Text>
            ) : null}
            {care.unreviewed ? (
              <Text style={styles.caveat}>Not yet reviewed by a horticulturist.</Text>
            ) : null}
            <CareCard guide={care.guide} compactMode={true} units={units} />
          </>
        ) : (
          <View style={styles.noCare}>
            <Text style={styles.noCareTitle}>No care notes for this plant yet</Text>
            <Text style={styles.noCareBody}>
              We'd rather show nothing than guess. More plants are being added.
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={handleDelete} style={styles.delete} accessibilityRole="button">
          <Icon name="trash" size={16} color={Colors.error} />
          <Text style={styles.deleteText}>Delete this plant</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Fact({ icon, text }: { icon: SFSymbol; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={15} color={Colors.textSecondary} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  detail,
  onPress,
  last = false,
}: {
  icon: SFSymbol;
  title: string;
  detail: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionRow, last && styles.actionRowLast]}
      accessibilityRole="button"
    >
      <View style={styles.actionIcon}>
        <Icon name={icon} size={18} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Icon name="chevron.right" size={14} color={Colors.textDisabled} weight="semibold" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.extra,
  },
  centred: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.loose,
  },
  stateTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  stateButton: {
    alignSelf: "stretch",
    marginTop: Spacing.loose,
  },
  editToggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  editToggleText: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
    fontWeight: "600",
  },
  cover: {
    width: "100%",
    height: 300,
    backgroundColor: Colors.glass,
  },
  content: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.loose,
  },
  name: {
    ...Typography.displayLarge,
    letterSpacing: 0,
    color: Colors.textPrimary,
  },
  scientificName: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: Spacing.compact,
  },
  facts: {
    marginTop: Spacing.default,
    gap: Spacing.tight,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
  },
  factText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  notes: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textPrimary,
    marginTop: Spacing.default,
  },
  editor: {
    gap: Spacing.tight,
  },
  fieldLabel: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  field: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    minHeight: 48,
    paddingHorizontal: Spacing.default,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glass,
    backgroundColor: Colors.surface,
  },
  fieldMultiline: {
    minHeight: 110,
    paddingTop: Spacing.default,
    textAlignVertical: "top",
  },
  saveButton: {
    marginTop: Spacing.default,
  },
  actions: {
    marginTop: Spacing.loose,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glass,
    backgroundColor: Colors.surface,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default,
    minHeight: 64,
    paddingHorizontal: Spacing.default,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glass,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  actionDetail: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginTop: Spacing.spacious,
    marginBottom: Spacing.default,
  },
  caveat: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  noCare: {
    padding: Spacing.loose,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.glass,
    alignItems: "center",
  },
  noCareTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  noCareBody: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
    textAlign: "center",
  },
  delete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.tight,
    minHeight: 48,
    marginTop: Spacing.spacious,
  },
  deleteText: {
    ...Typography.bodyLarge,
    color: Colors.error,
  },
});
