import { View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator, Alert, Share } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors, Radius, Shadow, Spacing, Tiles, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { CareCard } from "@components/CareCard";
import { ConfidenceMeter } from "@components/ConfidenceMeter";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
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

    await Share.share({ message: `${hedge} ${displayName(selected)} (${selected.scientificName})` });
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
  // several scans later, it's gone — this screen used to render blank.
  if (!capture && !result) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centred}>
          <View style={styles.stateCard}>
            <IconTile icon="photo.on.rectangle" color={Tiles.grey} size={52} />
            <Text style={styles.stateTitle}>That photo isn't available any more</Text>
            <Text style={styles.stateBody}>Take it again and we'll have another look.</Text>
            <Button label="Open the camera" icon="camera.fill" onPress={() => router.replace("/scan")} style={styles.stateButton} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {header}

      {/* DESIGN.md: the photo is the hero. Full width, no card. */}
      {capture ? <Image source={{ uri: capture.uri }} style={styles.photo} resizeMode="cover" /> : null}

      <View style={[styles.sheet, !capture && styles.sheetNoPhoto]}>
        {identifying && !result ? (
          <View style={styles.card}>
            <ActivityIndicator size="large" color={Colors.brand} />
            <Text style={styles.cardTitle}>Identifying your plant…</Text>
            <Text style={styles.cardBody}>This usually takes a few seconds.</Text>
          </View>
        ) : error && error.code === ErrorCode.DailyLimit ? (
          // No retry can work before the reset — and this is the one moment
          // Premium is genuinely relevant.
          <View style={styles.card}>
            <IconTile icon="hourglass" color={Tiles.amber} size={52} />
            <Text style={styles.cardTitle}>That's today's identifications</Text>
            <Text style={styles.cardBody}>{error.message}</Text>
            <Text style={styles.cardBody}>
              Premium removes the daily limit. Your collection, care notes and reminders keep working either way.
            </Text>
            <Button label="See Premium" icon="crown.fill" onPress={() => router.push("/subscription")} style={styles.cardButton} />
            <Button label="Back" variant="tertiary" onPress={goBack} style={styles.cardButtonTight} />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <IconTile icon="exclamationmark.triangle.fill" color={Tiles.red} size={52} />
            <Text style={styles.cardTitle}>Couldn't identify that one</Text>
            <Text style={styles.cardBody}>{error.message}</Text>
            {error.retryable ? <Text style={styles.cardFine}>This is usually temporary.</Text> : null}
            {/* A retry only where retrying could plausibly work. */}
            <Button
              label={error.retryable ? "Try again" : "Take another photo"}
              icon="camera.fill"
              onPress={goBack}
              style={styles.cardButton}
            />
          </View>
        ) : selected && selectedConfidence && topConfidence ? (
          <>
            <View style={styles.summary}>
              {notSure ? (
                // DESIGN.md: "Not sure" is a designed screen, not a failure —
                // no headline answer, just ranked guesses.
                <>
                  <IconTile icon="questionmark" color={Tiles.amber} size={40} />
                  <Text style={styles.summaryTitle}>We're not sure about this one</Text>
                  <Text style={styles.summaryBody}>
                    These are our best guesses. Compare them with your plant, or try a closer photo of a single leaf.
                  </Text>
                </>
              ) : (
                <>
                  {selected.taxonomy.family ? <Text style={styles.overline}>{selected.taxonomy.family}</Text> : null}
                  <Text style={styles.name}>{displayName(selected)}</Text>
                  {hasCommonName(selected) ? <Text style={styles.scientific}>{selected.scientificName}</Text> : null}
                  <View style={styles.meter}>
                    <ConfidenceMeter band={selectedConfidence.band} score={selected.rawScore} />
                  </View>
                  <Text style={styles.summaryBody}>
                    {selectedIndex === 0
                      ? explainBand(topConfidence.band)
                      : "You picked one of our other possibilities, so it's saved as your choice."}
                  </Text>
                </>
              )}
            </View>

            {notSure ? (
              <Candidates
                title="Best guesses"
                candidates={candidates}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            ) : null}

            {warnAboutToxicity && toxicityText ? (
              <View style={styles.toxicity}>
                <IconTile icon="exclamationmark.triangle.fill" color={Tiles.orange} size={36} />
                <View style={styles.toxicityText}>
                  <Text style={styles.toxicityTitle}>{toxicityText}</Text>
                  {care?.guide.toxicity.notes ? <Text style={styles.toxicityBody}>{care.guide.toxicity.notes}</Text> : null}
                  <Text style={styles.toxicityFine}>
                    If a pet or child has eaten this, contact a vet or your poison service. Don't wait on an app.
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>How to care for it</Text>
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
                  <Text style={styles.noCareBody}>We'd rather show nothing than guess.</Text>
                </View>
              </View>
            )}

            {!notSure && candidates.length > 1 ? (
              <Candidates
                title="Other possibilities"
                hint="Tap one if it matches your plant better."
                candidates={candidates}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            ) : null}

            <View style={styles.actions}>
              {savedId ? (
                <Button
                  label="View in My Plants"
                  icon="checkmark.circle.fill"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/plant-detail", params: { id: savedId } })}
                />
              ) : (
                <Button
                  label={notSure ? `Save "${displayName(selected)}"` : "Save to My Plants"}
                  icon="plus"
                  onPress={handleSave}
                  loading={saving}
                />
              )}
              <Button label="Not right? Take another photo" variant="tertiary" onPress={goBack} style={styles.cardButtonTight} />
            </View>
          </>
        ) : null}

        {/* dismissTo, not push: pushing "/" stacked another Home on top. */}
        <Pressable onPress={() => router.dismissTo("/")} style={styles.homeLink} accessibilityRole="button">
          <Text style={styles.homeLinkText}>Back to Home</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Candidates({
  title,
  hint,
  candidates,
  selectedIndex,
  onSelect,
}: {
  title: string;
  hint?: string;
  candidates: Species[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.caveat}>{hint}</Text> : null}
      <View style={styles.candidates}>
        {candidates.map((candidate, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={candidate.id}
              onPress={() => onSelect(index)}
              style={({ pressed }) => [styles.candidate, selected && styles.candidateSelected, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={[styles.rank, selected && styles.rankSelected]}>
                <Text style={[styles.rankText, selected && styles.rankTextSelected]}>{index + 1}</Text>
              </View>
              <View style={styles.candidateText}>
                <Text style={styles.candidateName}>{displayName(candidate)}</Text>
                {hasCommonName(candidate) ? <Text style={styles.candidateScientific}>{candidate.scientificName}</Text> : null}
              </View>
              <Text style={styles.candidateScore}>{Math.round(candidate.rawScore * 100)}%</Text>
              <Icon
                name={selected ? "checkmark.circle.fill" : "circle"}
                size={22}
                color={selected ? Colors.brand : Colors.textDisabled}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function hasCommonName(species: Species): boolean {
  const common = species.commonNames[0];
  return Boolean(common) && common !== species.scientificName;
}

function displayName(species: Species): string {
  return hasCommonName(species) ? species.commonNames[0] : species.scientificName;
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
  stateBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  stateButton: {
    alignSelf: "stretch",
    marginTop: Spacing.default,
  },
  photo: {
    width: "100%",
    height: 360,
    backgroundColor: Colors.separator,
  },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
  },
  sheetNoPhoto: {
    marginTop: 0,
  },
  card: {
    alignItems: "center",
    padding: Spacing.loose,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    gap: Spacing.tight,
    ...Shadow.card,
  },
  cardTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
  cardBody: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  cardFine: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  cardButton: {
    alignSelf: "stretch",
    marginTop: Spacing.default,
  },
  cardButtonTight: {
    alignSelf: "stretch",
    marginTop: Spacing.compact,
  },
  summary: {
    padding: Spacing.loose,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    ...Shadow.card,
  },
  overline: {
    ...Typography.overline,
    color: Colors.brand,
  },
  name: {
    ...Typography.displayLarge,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  scientific: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  meter: {
    marginTop: Spacing.loose,
  },
  summaryTitle: {
    ...Typography.display,
    color: Colors.textPrimary,
    marginTop: Spacing.default,
  },
  summaryBody: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginTop: Spacing.default - 4,
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
  toxicity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.default - 4,
    marginTop: Spacing.default,
    padding: Spacing.default,
    borderRadius: Radius.lg,
    backgroundColor: "#FDF0E8",
  },
  toxicityText: {
    flex: 1,
  },
  toxicityTitle: {
    ...Typography.subheadline,
    color: Colors.toxicity,
  },
  toxicityBody: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginTop: Spacing.compact,
  },
  toxicityFine: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
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
  candidates: {
    gap: Spacing.tight,
  },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.default - 4,
    minHeight: 64,
    paddingHorizontal: Spacing.default,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: "transparent",
  },
  candidateSelected: {
    borderColor: Colors.brand,
  },
  pressed: {
    opacity: 0.85,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  rankSelected: {
    backgroundColor: Colors.brandTint,
  },
  rankText: {
    ...Typography.caption1,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  rankTextSelected: {
    color: Colors.brandDark,
  },
  candidateText: {
    flex: 1,
    paddingVertical: Spacing.tight + 2,
  },
  candidateName: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
  },
  candidateScientific: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginTop: 1,
  },
  candidateScore: {
    ...Typography.caption1,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    marginTop: Spacing.spacious,
  },
  homeLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.default,
  },
  homeLinkText: {
    ...Typography.controlSmall,
    color: Colors.textSecondary,
  },
});
