import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { getApiClient, ApiError, DiagnosisResponse } from "@services/apiClient";
import { holdCapture, toIdentificationImage } from "@services/capture";

export default function DiseaseDetectionScreen() {
  const router = useRouter();
  const { plantId } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Photograph the affected part and have the server assess it.
   *
   * There is no local fallback. This previously waited two seconds and
   * reported "healthy, 95% confident" for any photo at all — which would
   * tell somebody with a dying plant to stop looking into it.
   */
  const handleAnalyzePhoto = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, base64: true });

      if (!photo?.uri) {
        throw new ApiError("Couldn't take that photo. Try again.", 0, true);
      }

      // Same pipeline as identification: downscaled and stripped of EXIF
      // before it leaves the phone.
      const capture = await holdCapture(photo.uri, photo.base64 ?? "");

      setDiagnosis(
        await getApiClient().diagnose(
          [toIdentificationImage(capture)],
          capture.hash,
          typeof plantId === "string" ? plantId : undefined
        )
      );
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Something went wrong.", 0, true));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRequestExpertHelp = () => {
    router.push({
      pathname: "/expert-escalation",
      params: { plantId },
    });
  };

  if (isAnalyzing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          <Text style={styles.loadingText}>Analyzing plant health...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.errorContent}>
        <Text style={styles.statusEmoji}>🌱</Text>
        <Text style={styles.statusTitle}>Couldn't check this one</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>

        <View style={styles.actionsSection}>
          {/* Only offer a retry when retrying could plausibly work. On a 403
              the plan is the problem, and the button would just fail again. */}
          {error.retryable ? (
            <Button label="Try again" onPress={() => setError(null)} />
          ) : error.status === 403 ? (
            <Button label="See Premium" onPress={() => router.push("/subscription")} />
          ) : (
            <Button label="Back" onPress={() => router.back()} />
          )}
        </View>
      </ScrollView>
    );
  }

  if (diagnosis) {
    const confidence = diagnosis.isHealthy
      ? diagnosis.healthyProbability
      : 1 - diagnosis.healthyProbability;

    return (
      <ScrollView style={styles.container}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusEmoji}>{diagnosis.isHealthy ? "✅" : "⚠️"}</Text>
          <Text style={styles.statusTitle}>
            {diagnosis.isHealthy ? "Looks healthy" : "Something's wrong"}
          </Text>
          <Text style={styles.confidence}>
            {Math.round(confidence * 100)}% confident
            {diagnosis.cached ? " · from an earlier check" : ""}
          </Text>
        </View>

        {diagnosis.diseases.length > 0 && (
          <View style={styles.diseasesSection}>
            <Text style={styles.sectionTitle}>Most likely causes</Text>

            {/* Ranked with likelihoods rather than asserting one answer. A
                yellow leaf is genuinely ambiguous (SPEC §3.4). */}
            {diagnosis.diseases.map((disease) => (
              <View key={disease.id} style={styles.diseaseItem}>
                <View style={styles.diseaseHeader}>
                  <Text style={styles.diseaseName}>{disease.name}</Text>
                  <Text style={styles.diseaseLikelihood}>
                    {Math.round(disease.probability * 100)}%
                  </Text>
                </View>

                {disease.description ? (
                  <Text style={styles.diseaseDescription}>{disease.description}</Text>
                ) : null}

                {disease.treatment?.prevention?.length ? (
                  <View style={styles.treatmentBlock}>
                    <Text style={styles.treatmentLabel}>What to do</Text>
                    {disease.treatment.prevention.map((step, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.recommendationText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* SPEC §10: guidance, not a pathology lab, and never phrased as
            medical advice. */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This is guidance, not a plant pathology lab. If several causes look
            similar, change one thing at a time and give it a week before judging.
          </Text>
        </View>

        <View style={styles.actionsSection}>
          <Button label="Check again" onPress={() => setDiagnosis(null)} />
          <TouchableOpacity style={styles.retryButton} onPress={handleRequestExpertHelp}>
            <Text style={styles.retryText}>Ask a human</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Permission has to be granted before the camera can mount at all.
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Check plant health</Text>
          <Text style={styles.subtitle}>Photograph the part that looks wrong</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔍</Text>
          </View>
          <Text style={styles.description}>
            Sorrel needs your camera to look at the affected leaves.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button label="Enable camera" onPress={() => requestPermission()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* The camera has to be mounted for a capture to be possible. Without
          this the ref stays null and every analysis fails silently. */}
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      <View style={styles.tipsOverlay}>
        <Text style={styles.tipsTitle}>Get close to the problem</Text>
        <Text style={styles.tip}>• Fill the frame with the affected leaf</Text>
        <Text style={styles.tip}>• Good light, no harsh shadows</Text>
        <Text style={styles.tip}>• Include the underside if you see pests</Text>
      </View>

      <View style={styles.footer}>
        <Button label="Take photo" onPress={handleAnalyzePhoto} />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
  },
  loadingText: {
    marginTop: Spacing.default,
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.spacious,
    paddingBottom: Spacing.default,
  },
  title: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.default,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: Spacing.loose,
  },
  icon: {
    fontSize: 64,
  },
  description: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.loose,
    lineHeight: 24,
  },
  tipsSection: {
    backgroundColor: Colors.glass,
    borderRadius: 12,
    padding: Spacing.default,
    marginBottom: Spacing.loose,
  },
  tipsTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  tip: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.compact,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.spacious,
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
    paddingHorizontal: Spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  statusEmoji: {
    fontSize: 48,
    marginBottom: Spacing.compact,
  },
  statusTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  confidence: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
  },
  camera: {
    flex: 1,
  },
  tipsOverlay: {
    position: "absolute",
    top: Spacing.extra,
    left: Spacing.default,
    right: Spacing.default,
    backgroundColor: "rgba(12, 42, 31, 0.78)",
    borderRadius: 10,
    padding: Spacing.default,
  },
  errorContent: {
    padding: Spacing.loose,
    paddingTop: Spacing.extra,
    alignItems: "center",
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
  diseasesSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  diseaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  diseaseLikelihood: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  diseaseDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.compact,
  },
  treatmentBlock: {
    marginTop: Spacing.default,
  },
  treatmentLabel: {
    ...Typography.caption1,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  disclaimer: {
    marginHorizontal: Spacing.default,
    marginTop: Spacing.loose,
    padding: Spacing.default,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  disclaimerText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  diseaseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.compact,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  diseaseName: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
  },
  severity: {
    fontSize: Typography.caption1.fontSize,
    fontWeight: "600" as any,
  },
  recommendationsSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  recommendationItem: {
    flexDirection: "row",
    marginBottom: Spacing.default,
  },
  bullet: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    marginRight: Spacing.compact,
    fontWeight: "bold" as any,
  },
  recommendationText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  actionsSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  retryButton: {
    marginTop: Spacing.default,
    paddingVertical: Spacing.default,
    alignItems: "center",
  },
  retryText: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
  },
});
