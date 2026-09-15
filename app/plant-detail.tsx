import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Image } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { SFSymbol } from "expo-symbols";
import { Colors, Radius, Shadow, Spacing, Tiles, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { CareCard } from "@components/CareCard";
import { ConfidenceMeter } from "@components/ConfidenceMeter";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
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

  // Coming back from the watering log or the journal must show what was just
  // added, so refresh (quietly) every time the screen is focused.
  useFocusEffect(
    useCallback(() => {
      void reload({ silent: true });
    }, [reload])
  );

  useEffect(() => {
    getUserPreferences()
      .then((prefs) => setUnits(prefs.units))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!plant) return;

    setEditData({
      nickname: plant.nickname || "",
      location: plant.location || "",
      notes: plant.notes || "",
    });

    // The lookup result, not just the guide, so the genus-level and
    // unreviewed caveats are shown here too.
    setCare(lookupCareGuide(plant.scientificName));
  }, [plant]);

  const handleSave = async () => {
    if (!plant || saving) return;

    setSaving(true);
    try {
      await updatePlant(plant.id, {
        // Empty strings mean "cleared" — store undefined so the field empties.
        nickname: editData.nickname?.trim() || undefined,
        location: editData.location?.trim() || undefined,
        notes: editData.notes?.trim() || undefined,
      });

      await reload({ silent: true });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save plant:", err);
      // Stay in edit mode so the typing isn't thrown away.
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
              // Don't navigate away — that would imply it worked.
              Alert.alert("Couldn't delete", `${getDisplayName(plant)} is still in your collection.`);
              return;
            }

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
        <ActivityIndicator size="large" color={Colors.brand} />
      </View>
    );
  }

  if (error || !plant) {
    return (
      <View style={styles.container}>
        <ScreenHeader onBack={goBack} backLabel="My Plants" />
        <View style={styles.centred}>
          <View style={styles.stateCard}>
            <IconTile icon="leaf.fill" color={Tiles.grey} size={52} />
            <Text style={styles.stateTitle}>
              {error ? "This plant couldn't be loaded" : "This plant isn't in your collection"}
            </Text>
            <Button label="Back to My Plants" onPress={goBack} style={styles.stateButton} />
          </View>
        </View>
      </View>
    );
  }

  const cover = getMostRecentPhoto(plant);
  const lastWatered = plant.waterLogs[0];
  const openWithPlant = (pathname: "/water-log" | "/photo-journal" | "/disease-detection") =>
    router.push({ pathname, params: { plantId: plant.id, plantName: getDisplayName(plant) } });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        onBack={goBack}
        backLabel="My Plants"
        right={
          <Pressable onPress={() => setIsEditing(!isEditing)} style={styles.editToggle} accessibilityRole="button">
            <Text style={styles.editToggleText}>{isEditing ? "Cancel" : "Edit"}</Text>
          </Pressable>
        }
      />

      {isEditing ? (
        <View style={styles.editor}>
          <Field label="Nickname" value={editData.nickname || ""} placeholder={plant.commonNames[0] ?? plant.scientificName} onChange={(nickname) => setEditData({ ...editData, nickname })} />
          <Field label="Where it lives" value={editData.location || ""} placeholder="e.g. Living room windowsill" onChange={(location) => setEditData({ ...editData, location })} />
          <Field label="Notes" value={editData.notes || ""} placeholder="Anything worth remembering" onChange={(notes) => setEditData({ ...editData, notes })} multiline />
          <Button label="Save changes" onPress={handleSave} loading={saving} disabled={saving} style={styles.editorButton} />
        </View>
      ) : (
        <>
          {/* DESIGN.md: the plant's own photo leads. */}
          <View style={styles.hero}>
            {cover ? (
              <Image source={{ uri: cover.imagePath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[Colors.brandLit, Colors.brandDeep]} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={["transparent", "rgba(0, 0, 0, 0.7)"]} style={styles.heroFade} pointerEvents="none" />
            <View style={styles.heroText}>
              <Text style={styles.heroName}>{getDisplayName(plant)}</Text>
              <Text style={styles.heroScientific}>{plant.scientificName}</Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.chips}>
              {plant.location ? <Fact icon="mappin.and.ellipse" text={plant.location} /> : null}
              <Fact
                icon="calendar"
                text={`Added ${new Date(plant.identificationDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
              />
            </View>

            {/* Everything you can do with this plant, one tap away. */}
            <View style={styles.actions}>
              <ActionTile
                icon="drop.fill"
                color={Tiles.blue}
                title="Water"
                detail={
                  lastWatered
                    ? new Date(lastWatered.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                    : "Not logged"
                }
                onPress={() => openWithPlant("/water-log")}
              />
              <ActionTile
                icon="photo.stack"
                color={Tiles.purple}
                title="Journal"
                detail={plant.photos.length === 0 ? "No photos" : `${plant.photos.length} photo${plant.photos.length === 1 ? "" : "s"}`}
                onPress={() => openWithPlant("/photo-journal")}
              />
              <ActionTile
                icon="stethoscope"
                color={Tiles.teal}
                title="Health"
                detail="Check a leaf"
                onPress={() => openWithPlant("/disease-detection")}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>When it was identified</Text>
              <ConfidenceMeter band={plant.confidenceBand} score={plant.rawScore} />
            </View>

            {plant.notes ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Notes</Text>
                <Text style={styles.notes}>{plant.notes}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Care</Text>
            {care ? (
              <>
                {care.matchedAt === "genus" || care.unreviewed ? (
                  <Text style={styles.caveat}>
                    {[
                      care.matchedAt === "genus"
                        ? `These notes cover the ${care.guide.scientificName.split(" ")[0]} genus in general, not this exact species.`
                        : null,
                      care.unreviewed ? "Not yet reviewed by a horticulturist." : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </Text>
                ) : null}
                <CareCard guide={care.guide} units={units} />
              </>
            ) : (
              <View style={styles.noCare}>
                <IconTile icon="book.closed.fill" color={Tiles.grey} size={36} />
                <View style={styles.noCareText}>
                  <Text style={styles.noCareTitle}>No care notes for this plant yet</Text>
                  <Text style={styles.noCareBody}>We'd rather show nothing than guess. More plants are being added.</Text>
                </View>
              </View>
            )}

            <Button label="Delete this plant" icon="trash" variant="destructive" onPress={handleDelete} style={styles.delete} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Fact({ icon, text }: { icon: SFSymbol; text: string }) {
  return (
    <View style={styles.chip}>
      <Icon name={icon} size={13} color={Colors.textSecondary} weight="semibold" />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

function ActionTile({
  icon,
  color,
  title,
  detail,
  onPress,
}: {
  icon: SFSymbol;
  color: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
    >
      <IconTile icon={icon} color={color} size={36} />
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDetail} numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.field, multiline && styles.fieldMultiline]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={Colors.textDisabled}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingBottom: Spacing.extra,
  },
  centred: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.default,
  },
  stateCard: {
    alignItems: "center",
    padding: Spacing.loose,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    gap: Spacing.tight,
  },
  stateTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
  stateButton: {
    alignSelf: "stretch",
    marginTop: Spacing.default,
  },
  editToggle: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  editToggleText: {
    ...Typography.bodyLarge,
    color: Colors.brand,
    fontWeight: "600",
  },
  hero: {
    marginHorizontal: Spacing.default,
    height: 340,
    borderRadius: Radius.xl,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: Colors.separator,
    ...Shadow.card,
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  heroText: {
    padding: Spacing.loose,
  },
  heroName: {
    ...Typography.displayLarge,
    color: "#FFFFFF",
  },
  heroScientific: {
    ...Typography.bodyLarge,
    fontStyle: "italic",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: Spacing.default,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.tight,
    marginTop: Spacing.default,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.default - 4,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
  },
  chipText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.tight + 2,
    marginTop: Spacing.default,
  },
  action: {
    flex: 1,
    padding: Spacing.default - 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    gap: 4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    marginTop: Spacing.tight,
  },
  actionDetail: {
    ...Typography.caption2,
    color: Colors.textSecondary,
  },
  card: {
    marginTop: Spacing.default,
    padding: Spacing.default,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    gap: Spacing.tight,
  },
  cardLabel: {
    ...Typography.overline,
    color: Colors.textSecondary,
  },
  notes: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginTop: Spacing.spacious,
    marginBottom: Spacing.default - 4,
  },
  caveat: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: -4,
    marginBottom: Spacing.default - 4,
  },
  noCare: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default - 4,
    padding: Spacing.default,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
  },
  noCareText: {
    flex: 1,
  },
  noCareTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  noCareBody: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  delete: {
    marginTop: Spacing.spacious,
  },
  editor: {
    marginHorizontal: Spacing.default,
    padding: Spacing.default,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    gap: Spacing.default - 4,
  },
  fieldLabel: {
    ...Typography.overline,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  field: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    minHeight: 50,
    paddingHorizontal: Spacing.default,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
  },
  fieldMultiline: {
    minHeight: 110,
    paddingTop: Spacing.default - 2,
    textAlignVertical: "top",
  },
  editorButton: {
    marginTop: Spacing.tight,
  },
});
