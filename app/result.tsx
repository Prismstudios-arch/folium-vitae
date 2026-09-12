import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";
import { ConfidenceBadge } from "@components/Card";
import { useIdentification } from "@hooks/useIdentification";
import { IdentificationResult, CalibratedConfidence } from "@types/plant";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const imageUri = params.imageUri as string | undefined;

  const { identify, identifying, result, confidence, error } = useIdentification();
  const [hasIdentified, setHasIdentified] = useState(false);

  // Trigger identification on mount
  useEffect(() => {
    if (imageUri && !hasIdentified) {
      identify(imageUri).catch((err) => {
        console.error("Identification failed:", err);
      });
      setHasIdentified(true);
    }
  }, [imageUri, hasIdentified, identify]);

  const topCandidate = result?.candidates[0];
  const alternatives = result?.candidates.slice(1, 3) || [];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
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
            <Text style={styles.errorText}>{error.description}</Text>
            {error.recovery && <Text style={styles.recoveryText}>{error.recovery}</Text>}

            <Button label="Try Again" onPress={() => router.back()} style={styles.marginTop} />
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
              <Button label="Save to My Plants" onPress={() => router.push("/")} />
              <SecondaryButton label="Share" onPress={() => {}} style={styles.marginTop} />
              <TouchableOpacity onPress={() => router.back()} style={styles.marginTop}>
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
