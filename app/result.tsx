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
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";
import { ConfidenceBadge } from "@components/Card";
import { useIdentification } from "@hooks/useIdentification";
import { getCapture, toIdentificationImage } from "@services/capture";
import * as Haptics from "expo-haptics";
import { ConfidenceBand, getToxicityText } from "@domain/plant";
import { CareCard } from "@components/CareCard";
import { lookupCareGuide } from "@services/careDatabase";
import { getUserPreferences } from "@services/userPreferences";
import { createPlant, addPhoto } from "@services/database";
import { useGoBack } from "@hooks/useGoBack";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const imageHash = params.imageHash as string | undefined;
  const capture = imageHash ? getCapture(imageHash) : undefined;
  const imageUri = capture?.uri;

  const goBack = useGoBack("/");
  const { identify, identifying, result, confidence, error } = useIdentification();
  const [hasIdentified, setHasIdentified] = useState(false);

  // Identify once on mount. The guard matters because the effect re-runs on
  // every state change the identify call itself causes.
  useEffect(() => {
    if (!capture || hasIdentified) return;

    setHasIdentified(true);

    identify([toIdentificationImage(capture)], capture.hash).catch(() => {
      // Already surfaced through the hook's error state; the screen renders
      // it. Swallowing here only stops an unhandled rejection warning.
    });
  }, [capture, hasIdentified, identify]);

  const topCandidate = result?.candidates[0];
  const alternatives = result?.candidates.slice(1, 3) || [];

  // Care notes for whatever we landed on, plus whether this user asked to be
  // warned about toxicity. SPEC §5 wants the care summary and a prominent
  // toxicity badge here; neither was shown.
  const care = topCandidate ? lookupCareGuide(topCandidate.scientificName) : null;
  const [warnAboutToxicity, setWarnAboutToxicity] = useState(true);

  useEffect(() => {
    getUserPreferences()
      .then((prefs) => setWarnAboutToxicity(prefs.showToxicityWarnings))
      .catch(() => {
        // Default to warning. Failing closed on a safety message is the only
        // sensible direction.
      });
  }, []);

  const toxicityText = care ? getToxicityText(care.guide.toxicity) : null;

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  /**
   * Actually write the plant to the collection.
   *
   * This button previously only navigated home, so identifying a plant and
   * tapping Save did nothing at all — the single most important action in
   * the app was a no-op.
   */
  const handleSave = async () => {
    if (!topCandidate || !confidence || saving) return;

    setSaving(true);
    try {
      const plant = await createPlant({
        scientificName: topCandidate.scientificName,
        commonNames: topCandidate.commonNames,
        identificationDate: new Date(),
        confidenceBand: confidence.band,
        rawScore: confidence.rawScore,
        calibratedScore: confidence.calibratedScore,
        sortOrder: 0,
        isFavorited: false,
      });

      // Keep the photo that produced the identification as the first entry
      // in the journal. Best effort — losing it must not lose the plant.
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

      setSavedId(plant.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Failed to save plant:", err);
      Alert.alert("Couldn't save", "That plant wasn't added to your collection. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!topCandidate || !confidence) return;

    // Honest about uncertainty even in a share. Passing off a "not sure"
    // as a firm identification is the thing this product is against.
    const hedge =
      confidence.band === ConfidenceBand.Confident
        ? "Identified with"
        : confidence.band === ConfidenceBand.Probably
          ? "Probably"
          : "Best guess:";

    await Share.share({
      message:
        `${hedge} ${topCandidate.commonNames[0] ?? topCandidate.scientificName} ` +
        `(${topCandidate.scientificName})\n\nIdentified with Sorrel.`,
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Photo */}
      {imageUri && <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />}

      <View style={styles.content}>
        {identifying && !result ? (
          // Loading state
          <>
            <ActivityIndicator size="large" color={Colors.leaf} style={styles.spinner} />
            <Text style={styles.subtitle}>Identifying your plant…</Text>
          </>
        ) : error ? (
          // Error state
          <>
            <Text style={styles.title}>Identification failed</Text>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.retryable && (
              <Text style={styles.recoveryText}>This one is usually temporary.</Text>
            )}

            {/* Offer a retry only when retrying could plausibly work. A
                button that cannot succeed is worse than no button. */}
            <Button
              label={error.retryable ? "Try again" : "Back to camera"}
              onPress={() => router.back()}
              style={styles.marginTop}
            />
          </>
        ) : result && topCandidate && confidence ? (
          // Success state
          <>
            {/* Confidence Band */}
            <View style={styles.confidenceContainer}>
              <ConfidenceBadge band={confidence.band as any} />
            </View>

            {/* Plant Name */}
            <Text style={styles.title}>{topCandidate.commonNames[0]}</Text>
            <Text style={styles.scientific}>{topCandidate.scientificName}</Text>
            {topCandidate.taxonomy.family && (
              <Text style={styles.family}>Family: {topCandidate.taxonomy.family}</Text>
            )}

            {/* Confidence Explanation */}
            <View style={styles.confidenceExplainer}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={styles.confidenceExplanation}>{getConfidenceExplanation(confidence.band)}</Text>
              <Text style={styles.scoreText}>
                Score: {(topCandidate.rawScore * 100).toFixed(0)}%
              </Text>
            </View>

            {/* Toxicity — above the care card, because where you put a plant
                is decided before how you water it. SPEC §8.4 names burying
                this as the complaint we are meant to beat. */}
            {warnAboutToxicity && toxicityText && (
              <View style={styles.toxicityWarning}>
                <Text style={styles.toxicityTitle}>⚠️ {toxicityText}</Text>
                {care?.guide.toxicity.notes && (
                  <Text style={styles.toxicityNotes}>{care.guide.toxicity.notes}</Text>
                )}
                <Text style={styles.toxicityDisclaimer}>
                  If a pet or child has eaten this, contact a vet or your poison
                  service. Don't wait on an app.
                </Text>
              </View>
            )}

            {/* Care summary */}
            {care && (
              <View style={styles.careSection}>
                {care.matchedAt === "genus" && (
                  <Text style={styles.careCaveat}>
                    These notes are for the {care.guide.scientificName} genus, not
                    this exact species.
                  </Text>
                )}
                {care.unreviewed && (
                  <Text style={styles.careCaveat}>
                    Not yet reviewed by a botanist.
                  </Text>
                )}
                <CareCard guide={care.guide} compactMode={true} />
              </View>
            )}

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <View style={styles.alternativesBox}>
                <Text style={styles.alternativesTitle}>Other possibilities</Text>
                {alternatives.map((alt, idx) => (
                  <View key={idx} style={styles.alternativeItem}>
                    <Text style={styles.alternativeName}>{alt.commonNames[0]}</Text>
                    <Text style={styles.alternativeScore}>
                      {(alt.rawScore * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              {savedId ? (
                <Button
                  label="View in My Plants"
                  onPress={() => router.push({ pathname: "/plant-detail", params: { id: savedId } })}
                />
              ) : (
                <Button label="Save to My Plants" onPress={handleSave} loading={saving} />
              )}

              <SecondaryButton label="Share" onPress={handleShare} style={styles.marginTop} />

              <TouchableOpacity onPress={goBack} style={styles.marginTop}>
                <Text style={styles.link}>Not right? Try again</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* Navigation */}
        <TouchableOpacity onPress={() => router.push("/")} style={styles.homeLink}>
          <Text style={styles.link}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getConfidenceExplanation(band: string): string {
  switch (band) {
    case "confident":
      return "We're quite sure about this identification.";
    case "probably":
      return "This is our best guess, but there are alternatives. Check them above.";
    case "notSure":
      return "We're not confident enough to pick one answer. Consider the alternatives above.";
    default:
      return "";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  backButton: {
    color: Colors.leaf,
    fontSize: Typography.button.fontSize,
    fontWeight: Typography.button.fontWeight as any,
  },
  photo: {
    width: "100%",
    height: 300,
    backgroundColor: Colors.glass,
  },
  content: {
    padding: Spacing.default,
  },
  spinner: {
    marginBottom: Spacing.default,
  },
  title: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  subtitle: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.loose,
  },
  scientific: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    fontStyle: "italic",
    marginBottom: Spacing.tight,
  },
  family: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textDisabled,
    marginBottom: Spacing.loose,
  },
  errorText: {
    fontSize: Typography.body.fontSize,
    color: Colors.error,
    marginBottom: Spacing.default,
  },
  recoveryText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.default,
  },
  confidenceContainer: {
    marginBottom: Spacing.default,
  },
  confidenceExplainer: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  confidenceLabel: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
  },
  confidenceExplanation: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  scoreText: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textDisabled,
  },
  alternativesBox: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  alternativesTitle: {
    fontSize: Typography.caption1.fontSize,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.default,
  },
  alternativeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.tight,
    borderBottomColor: Colors.glass,
    borderBottomWidth: 1,
  },
  alternativeName: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
  },
  alternativeScore: {
    fontSize: Typography.caption1.fontSize,
    color: Colors.textSecondary,
  },
  buttonGroup: {
    marginBottom: Spacing.spacious,
  },
  toxicityWarning: {
    backgroundColor: "rgba(160, 82, 45, 0.10)",
    borderLeftWidth: 3,
    borderLeftColor: Colors.toxicity,
    borderRadius: 6,
    padding: Spacing.default,
    marginTop: Spacing.loose,
  },
  toxicityTitle: {
    ...Typography.subheadline,
    color: Colors.toxicity,
  },
  toxicityNotes: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.compact,
  },
  toxicityDisclaimer: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  careSection: {
    marginTop: Spacing.loose,
  },
  careCaveat: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  marginTop: {
    marginTop: Spacing.default,
  },
  homeLink: {
    marginTop: Spacing.spacious,
    marginBottom: Spacing.spacious,
  },
  link: {
    color: Colors.leaf,
    fontSize: Typography.body.fontSize,
    textAlign: "center",
  },
});
