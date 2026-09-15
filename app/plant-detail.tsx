import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Image } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { SFSymbol } from "expo-symbols";
import { Radius, Shadow, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
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
import type { Hemisphere } from "@services/wateringInsights";
import { getUserPreferences } from "@services/userPreferences";
import { cancelWateringReminder } from "@services/wateringReminders";
import { updatePlant, deletePlant } from "@services/database";
import { calibrateConfidence } from "@services/identification";
import { selectionFeedback } from "@utils/feedback";
import { formatCommonName } from "@utils/plantNames";
import {
  ConfidenceBand,
  MIN_ALTERNATIVE_SCORE,
  SavedPlant,
  Species,
  getDisplayName,
  getMostRecentPhoto,
} from "@domain/plant";

export default function PlantDetailScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useGoBack("/my-plants");
  const params = useLocalSearchParams<{ id?: string }>();
  const plantId = params.id ?? "";

  const { plant, loading, error, reload } = usePlant(plantId);
  const [care, setCare] = useState<CareLookupResult | null>(null);
  const [units, setUnits] = useState<Units>("metric");
  const [hemisphere, setHemisphere] = useState<Hemisphere>("north");
  // Warnings default on: failing closed on a safety message is the only
  // sensible direction.
  const [showToxicity, setShowToxicity] = useState(true);
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
      .then((prefs) => {
        setUnits(prefs.units);
        setHemisphere(prefs.hemisphere);
        setShowToxicity(prefs.showToxicityWarnings);
      })
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
          <Field label="Nickname" value={editData.nickname || ""} placeholder={plant.commonNames[0] ? formatCommonName(plant.commonNames[0]) : plant.scientificName} onChange={(nickname) => setEditData({ ...editData, nickname })} />
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
              {plant.confidenceBand === ConfidenceBand.NotSure ? (
                <View style={styles.heroBadge}>
                  <Icon name="questionmark.circle.fill" size={13} color="#FFFFFF" weight="semibold" />
                  <Text style={styles.heroBadgeText}>Unconfirmed ID</Text>
                </View>
              ) : null}
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

            <IdentificationCard plant={plant} onChanged={() => void reload({ silent: true })} />

            {plant.notes ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Notes</Text>
                <Text style={styles.notes}>{plant.notes}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Care</Text>
            {care ? (
              <CareCard
                care={care}
                units={units}
                hemisphere={hemisphere}
                toxicity={showToxicity ? "full" : "hidden"}
              />
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

/**
 * How sure the identification was — and, when it wasn't certain, the other
 * possibilities it was saved with, any of which can be used instead.
 *
 * A low-confidence plant used to be saved under its best guess with nothing
 * on its page to say the name was a guess.
 */
function IdentificationCard({ plant, onChanged }: { plant: SavedPlant; onChanged: () => void }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [changing, setChanging] = useState(false);

  const certain = plant.confidenceBand === ConfidenceBand.Confident;
  const alternatives = savedCandidates(plant).filter(
    (candidate) => candidate.scientificName !== plant.scientificName && candidate.rawScore >= MIN_ALTERNATIVE_SCORE
  );

  const choose = (candidate: Species) => {
    Alert.alert(
      `Change to ${speciesName(candidate)}?`,
      "Its care notes change to match. Photos, notes and watering history stay as they are.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change",
          onPress: async () => {
            setChanging(true);
            try {
              const confidence = calibrateConfidence(candidate.rawScore);
              await updatePlant(plant.id, {
                scientificName: candidate.scientificName,
                commonNames: candidate.commonNames,
                confidenceBand: confidence.band,
                rawScore: confidence.rawScore,
                calibratedScore: confidence.calibratedScore,
              });
              onChanged();
            } catch (err) {
              console.error("Failed to change identification:", err);
              Alert.alert("Couldn't change it", "The plant is still saved as it was. Try again.");
            } finally {
              setChanging(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Identification</Text>
      <ConfidenceMeter band={plant.confidenceBand} score={plant.rawScore} />

      {!certain ? (
        <Text style={styles.idNote}>
          {plant.confidenceBand === ConfidenceBand.NotSure
            ? "Sorrel wasn't sure about this one, so treat the name as a guess."
            : "Probably right, but worth comparing with the other possibilities."}
          {alternatives.length > 0
            ? " If another looks closer, tap it to use that instead."
            : " A clear photo of a single leaf usually gets a surer answer."}
        </Text>
      ) : null}

      {!certain && alternatives.length > 0 ? (
        <View style={styles.alternatives}>
          {alternatives.map((candidate, index) => (
            <Pressable
              key={`${candidate.scientificName}-${index}`}
              onPress={() => {
                selectionFeedback();
                choose(candidate);
              }}
              disabled={changing}
              style={({ pressed }) => [
                styles.alternative,
                index === alternatives.length - 1 && styles.alternativeLast,
                pressed && styles.alternativePressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${speciesName(candidate)} instead. ${Math.round(candidate.rawScore * 100)} percent match`}
            >
              <View style={styles.alternativeText}>
                <Text style={styles.alternativeName}>{speciesName(candidate)}</Text>
                {speciesName(candidate) !== candidate.scientificName ? (
                  <Text style={styles.alternativeScientific}>{candidate.scientificName}</Text>
                ) : null}
              </View>
              <Text style={styles.alternativeScore}>{Math.round(candidate.rawScore * 100)}%</Text>
              <Icon name="chevron.right" size={13} color={Colors.textDisabled} weight="semibold" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The candidates kept with the plant when it was saved. Plants saved before they were kept have none. */
function savedCandidates(plant: SavedPlant): Species[] {
  if (!plant.providerData) return [];

  try {
    const data = JSON.parse(plant.providerData) as { candidates?: unknown };
    if (!Array.isArray(data.candidates)) return [];

    return data.candidates.filter(
      (candidate): candidate is Species =>
        typeof candidate === "object" &&
        candidate !== null &&
        typeof (candidate as Species).scientificName === "string" &&
        Array.isArray((candidate as Species).commonNames) &&
        typeof (candidate as Species).rawScore === "number"
    );
  } catch {
    return [];
  }
}

function speciesName(species: Species): string {
  const common = species.commonNames[0];
  return common && common !== species.scientificName ? formatCommonName(common) : species.scientificName;
}

function Fact({ icon, text }: { icon: SFSymbol; text: string }) {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
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
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
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

const createStyles = (Colors: Palette) =>
  StyleSheet.create({
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
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: Radius.pill,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      marginBottom: Spacing.tight,
    },
    heroBadgeText: {
      ...Typography.caption2,
      fontWeight: "600",
      color: "#FFFFFF",
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
    idNote: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: Spacing.compact,
    },
    alternatives: {
      marginTop: Spacing.compact,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.separator,
    },
    alternative: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.tight,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.separator,
    },
    alternativeLast: {
      borderBottomWidth: 0,
    },
    alternativePressed: {
      opacity: 0.6,
    },
    alternativeText: {
      flex: 1,
      paddingVertical: Spacing.tight,
    },
    alternativeName: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
    },
    alternativeScientific: {
      ...Typography.caption1,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 1,
    },
    alternativeScore: {
      ...Typography.caption1,
      fontWeight: "600",
      color: Colors.textSecondary,
      fontVariant: ["tabular-nums"],
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
