import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";
import { ConfidenceBadge } from "@components/Card";
import { CareCard } from "@components/CareCard";
import { Icon } from "@components/Icon";
import { ScreenHeader, HeaderIconButton } from "@components/ScreenHeader";
import { useIdentification } from "@hooks/useIdentification";
import { useGoBack } from "@hooks/useGoBack";
import { getCapture, toIdentificationImage } from "@services/capture";
import { calibrateConfidence } from "@services/identification";
import { lookupCareGuide } from "@services/careDatabase";
import { getUserPreferences } from "@services/userPreferences";
import { createPlant, addPhoto } from "@services/database";
import { ErrorCode } from "@services/apiClient";
import { ConfidenceBand, Species, getToxicityText } from "@domain/plant";

const MAX_CANDIDATES = 3;

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageHash?: string }>();
  const capture = params.imageHash ? getCapture(params.imageHash) : undefined;

  const goBack = useGoBack("/");
  const { identify, identifying, result, error } = useIdentification();
  const [started, setStarted] = useState(false);

  // Which candidate the person is looking at, and would save. Choosing one
  // of the other possibilities is how someone says "it's actually this".
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const [warnAboutToxicity, setWarnAboutToxicity] = useState(true);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");

  // Identify once. The guard matters because the effect re-runs on every
  // state change the identify call itself causes.
  useEffect(() => {
    if (!capture || started) return;
    setStarted(true);

    identify([toIdentificationImage(capture)], capture.hash).catch(() => {
      // Surfaced through the hook's error state, which the screen renders.
    });
  }, [capture, started, identify]);

  useEffect(() => {
    getUserPreferences()
      .then((prefs) => {
        setWarnAboutToxicity(prefs.showToxicityWarnings);
        setUnits(prefs.units);
      })
      .catch(() => {
        // Default to warning. Failing closed on a safety message is the only
        // sensible direction.
      });
  }, []);

  const candidates = result?.candidates.slice(0, MAX_CANDIDATES) ?? [];
  const top = candidates[0];
  const topConfidence = top ? calibrateConfidence(top.rawScore) : null;
  const notSure = topConfidence?.band === ConfidenceBand.NotSure;

  const selected: Species | undefined = candidates[selectedIndex] ?? top;
  const selectedConfidence = selected ? calibrateConfidence(selected.rawScore) : null;
  const care = selected ? lookupCareGuide(selected.scientificName) : null;
  const toxicityText = care ? getToxicityText(care.guide.toxicity) : null;
  const savedId = savedIds[selectedIndex];

  const handleSave = async () => {
    if (!selected || !selectedConfidence || !result || saving) return;

    setSaving(true);
    try {
      const plant = await createPlant({
        scientificName: selected.scientificName,
        commonNames: selected.commonNames,
        identificationDate: new Date(),
        confidenceBand: selectedConfidence.band,
        rawScore: selectedConfidence.rawScore,
        calibratedScore: selectedConfidence.calibratedScore,
        // What the provider actually said, so the plant's page can later show
        // the other possibilities rather than only the one that was picked.
        providerData: JSON.stringify({ provider: result.provider, candidates }),
        sortOrder: 0,
        isFavorited: false,
      });

      // The photo that produced the identification becomes the first journal
      // entry. Best effort — losing it must not lose the plant.
      if (capture) {
        try {
          await addPhoto(plant.id, {
            dateTaken: capture.takenAt,
            imagePath: capture.uri,
            imageHash: capture.hash,
          });
        } catch (err) {
          console.warn("Saved the plant but not its photo:", err);
        }
      }

      setSavedIds((current) => ({ ...current, [selectedIndex]: plant.id }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error("Failed to save plant:", err);
      Alert.alert("Couldn't save", "That plant wasn't added to your collection. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!selected || !selectedConfidence) return;

    // Honest about uncertainty even in a share.
    const hedge =
      selectedConfidence.band === ConfidenceBand.Confident
        ? "Identified with Sorrel:"
        : selectedConfidence.band === ConfidenceBand.Probably
          ? "Probably"
          : "Sorrel's best guess:";

    await Share.share({
      message: `${hedge} ${displayName(selected)} (${selected.scientificName})`,
    });
  };

  const header = (
    <ScreenHeader
      onBack={goBack}
      right={
        selected && !identifying ? (
          <HeaderIconButton icon="square.and.arrow.up" label="Share" onPress={handleShare} />
        ) : undefined
      }
    />
  );

  // The held photo lives in memory only. After the app has been closed, or
  // several scans later, it is gone — this screen used to render blank.
  if (!capture && !result) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centred}>
          <Icon name="photo.on.rectangle" size={34} color={Colors.textSecondary} />
          <Text style={styles.stateTitle}>That photo isn't available any more</Text>
          <Text style={styles.stateBody}>Take it again and we'll have another look.</Text>
          <Button label="Open the camera" onPress={() => router.replace("/scan")} style={styles.stateButton} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {header}

      {capture ? (
        <Image source={{ uri: capture.uri }} style={styles.photo} resizeMode="cover" />
      ) : null}

      <View style={styles.content}>
        {identifying && !result ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.leaf} />
            <Text style={styles.loadingTitle}>Identifying your plant…</Text>
            <Text style={styles.loadingBody}>This usually takes a few seconds.</Text>
          </View>
        ) : error && error.code === ErrorCode.DailyLimit ? (
          // No retry can work before the reset, so this isn't a "Try again"
          // loop — and it's the one moment Premium is genuinely relevant.
          <>
            <Text style={styles.title}>That's today's identifications</Text>
            <Text style={styles.body}>{error.message}</Text>
            <Text style={styles.body}>
              Premium removes the daily limit. Your collection, care notes and reminders keep
              working either way.
            </Text>
            <Button label="See Premium" onPress={() => router.push("/subscription")} style={styles.gapTop} />
            <SecondaryButton label="Back" onPress={goBack} style={styles.gapTopSmall} />
          </>
        ) : error ? (
          <>
            <Text style={styles.title}>Couldn't identify that one</Text>
            <Text style={styles.body}>{error.message}</Text>
            {error.retryable ? (
              <Text style={styles.caption}>This is usually temporary.</Text>
            ) : null}
            {/* A retry only where retrying could plausibly work. */}
            <Button
              label={error.retryable ? "Try again" : "Take another photo"}
              onPress={goBack}
              style={styles.gapTop}
            />
          </>
        ) : selected && selectedConfidence && topConfidence ? (
          <>
            {notSure ? (
              // DESIGN.md: "Not sure" is a designed screen, not a failure —
              // no headline answer and no badge, just ranked guesses.
              <>
                <Text style={styles.title}>We're not sure about this one</Text>
                <Text style={styles.body}>
                  These are our best guesses. Compare them with your plant, or try a closer photo of
                  a single leaf.
                </Text>
                <View style={styles.list}>
                  {candidates.map((candidate, index) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      rank={index + 1}
                      selected={index === selectedIndex}
                      onPress={() => setSelectedIndex(index)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                {selectedIndex === 0 ? (
                  <ConfidenceBadge band={topConfidence.band as "confident" | "probably" | "notSure"} />
                ) : null}
                <Text style={styles.name}>{displayName(selected)}</Text>
                {hasCommonName(selected) ? (
                  <Text style={styles.scientific}>{selected.scientificName}</Text>
                ) : null}
                {selected.taxonomy.family ? (
                  <Text style={styles.caption}>{selected.taxonomy.family}</Text>
                ) : null}

                <Text style={styles.explanation}>
                  {selectedIndex === 0
                    ? explainBand(topConfidence.band)
                    : `You've picked one of our other possibilities. We gave it ${percent(selected.rawScore)}.`}
                </Text>
              </>
            )}

            {warnAboutToxicity && toxicityText ? (
              <View style={styles.toxicity}>
                <View style={styles.toxicityHeader}>
                  <Icon name="exclamationmark.triangle.fill" size={18} color={Colors.toxicity} />
                  <Text style={styles.toxicityTitle}>{toxicityText}</Text>
                </View>
                {care?.guide.toxicity.notes ? (
                  <Text style={styles.toxicityNotes}>{care.guide.toxicity.notes}</Text>
                ) : null}
                <Text style={styles.toxicityDisclaimer}>
                  If a pet or child has eaten this, contact a vet or your poison service. Don't wait on
                  an app.
                </Text>
              </View>
            ) : null}

            {care ? (
              <View style={styles.section}>
                {care.matchedAt === "genus" ? (
                  <Text style={styles.caveat}>
                    These notes cover the {care.guide.scientificName.split(" ")[0]} genus in general,
                    not this exact species.
                  </Text>
                ) : null}
                {care.unreviewed ? (
                  <Text style={styles.caveat}>Not yet reviewed by a horticulturist.</Text>
                ) : null}
                <CareCard guide={care.guide} compactMode={true} units={units} />
              </View>
            ) : (
              <Text style={[styles.caption, styles.section]}>
                We don't have care notes for this plant yet. We'd rather show nothing than guess.
              </Text>
            )}

            {!notSure && candidates.length > 1 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other possibilities</Text>
                <Text style={styles.caption}>Tap one if it matches your plant better.</Text>
                <View style={styles.list}>
                  {candidates.map((candidate, index) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      rank={index + 1}
                      selected={index === selectedIndex}
                      onPress={() => setSelectedIndex(index)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              {savedId ? (
                <Button
                  label="View in My Plants"
                  onPress={() => router.push({ pathname: "/plant-detail", params: { id: savedId } })}
                />
              ) : (
                <Button
                  label={notSure ? `Save "${displayName(selected)}"` : "Save to My Plants"}
                  onPress={handleSave}
                  loading={saving}
                />
              )}

              <TouchableOpacity onPress={goBack} style={styles.textAction} accessibilityRole="button">
                <Text style={styles.textActionLabel}>Not right? Take another photo</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* dismissTo, not push: pushing "/" stacked another Home on top of the
            camera and the result, so Back from Home went somewhere odd. */}
        <TouchableOpacity
          onPress={() => router.dismissTo("/")}
          style={styles.textAction}
          accessibilityRole="button"
        >
          <Text style={styles.textActionLabel}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function hasCommonName(species: Species): boolean {
  const common = species.commonNames[0];
  return Boolean(common) && common !== species.scientificName;
}

function displayName(species: Species): string {
  return hasCommonName(species) ? species.commonNames[0] : species.scientificName;
}

function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function explainBand(band: ConfidenceBand): string {
  switch (band) {
    case ConfidenceBand.Confident:
      return "We're confident about this one.";
    case ConfidenceBand.Probably:
      return "This is probably it, but it's worth checking the other possibilities below.";
    default:
      return "";
  }
}

function CandidateRow({
  candidate,
  rank,
  selected,
  onPress,
}: {
  candidate: Species;
  rank: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.candidate, selected && styles.candidateSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Text style={styles.candidateRank}>{rank}</Text>
      <View style={styles.candidateText}>
        <Text style={styles.candidateName}>{displayName(candidate)}</Text>
        {hasCommonName(candidate) ? (
          <Text style={styles.candidateScientific}>{candidate.scientificName}</Text>
        ) : null}
      </View>
      <Text style={styles.candidateScore}>{percent(candidate.rawScore)}</Text>
      <Icon
        name={selected ? "checkmark.circle.fill" : "circle"}
        size={22}
        color={selected ? Colors.leaf : Colors.textDisabled}
      />
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.loose,
    gap: Spacing.tight,
  },
  stateTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.default,
  },
  stateBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  stateButton: {
    alignSelf: "stretch",
    marginTop: Spacing.loose,
  },
  // Full width, no card, no rounded corners — DESIGN.md: the photo is the hero.
  photo: {
    width: "100%",
    height: 320,
    backgroundColor: Colors.glass,
  },
  content: {
    padding: Spacing.default,
    paddingTop: Spacing.loose,
  },
  loading: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
    gap: Spacing.tight,
  },
  loadingTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    marginTop: Spacing.default,
  },
  loadingBody: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  title: {
    ...Typography.display,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  name: {
    ...Typography.displayLarge,
    letterSpacing: 0,
    color: Colors.leaf,
    marginTop: Spacing.default,
  },
  scientific: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: Spacing.compact,
  },
  body: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  caption: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.compact,
  },
  explanation: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textPrimary,
    marginTop: Spacing.default,
  },
  gapTop: {
    marginTop: Spacing.loose,
  },
  gapTopSmall: {
    marginTop: Spacing.tight,
  },
  toxicity: {
    marginTop: Spacing.loose,
    padding: Spacing.default,
    borderRadius: 12,
    backgroundColor: "rgba(160, 82, 45, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(160, 82, 45, 0.35)",
  },
  toxicityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
  },
  toxicityTitle: {
    ...Typography.subheadline,
    color: Colors.toxicity,
    flex: 1,
  },
  toxicityNotes: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  toxicityDisclaimer: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  section: {
    marginTop: Spacing.loose,
  },
  sectionTitle: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  caveat: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  list: {
    marginTop: Spacing.default,
    gap: Spacing.tight,
  },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default,
    minHeight: 60,
    paddingHorizontal: Spacing.default,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.glass,
  },
  candidateSelected: {
    borderColor: Colors.leaf,
    backgroundColor: "rgba(45, 88, 66, 0.05)",
  },
  candidateRank: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    width: 14,
    fontVariant: ["tabular-nums"],
  },
  candidateText: {
    flex: 1,
    paddingVertical: Spacing.tight,
  },
  candidateName: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  candidateScientific: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  candidateScore: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    marginTop: Spacing.spacious,
  },
  textAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.tight,
  },
  textActionLabel: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
  },
});
