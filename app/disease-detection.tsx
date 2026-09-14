import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useState, useRef, useCallback } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";
import {
  getApiClient,
  ApiError,
  ErrorCode,
  DiagnosisResponse,
  DiseaseFinding,
} from "@services/apiClient";
import { holdCapture, toIdentificationImage } from "@services/capture";
import { useGoBack } from "@hooks/useGoBack";

/** "checking" until the server says; "unknown" when it can't be reached. */
type PlanState = "checking" | "free" | "paid" | "unknown";

/**
 * Capturing keeps the camera mounted. The previous version swapped the
 * camera for a spinner the instant the shutter was pressed, unmounting the
 * view while takePictureAsync was still using it.
 */
type Phase = "idle" | "capturing" | "analysing";

/**
 * The provider's probability, in words. Same thresholds as identification
 * (0.75 and 0.5) so the app never describes one number two ways.
 */
function describeLikelihood(probability: number): string {
  if (probability >= 0.75) return "Fairly sure";
  if (probability >= 0.5) return "Leaning this way";
  return "Not sure — treat this as a guess";
}

export default function DiseaseDetectionScreen() {
  const router = useRouter();
  const goBack = useGoBack("/my-plants");
  const { plantId, plantName } = useLocalSearchParams<{ plantId?: string; plantName?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [planState, setPlanState] = useState<PlanState>("checking");
  const [phase, setPhase] = useState<Phase>("idle");
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Health checks are Premium. Free users used to find that out only after
  // photographing the leaf and waiting on an upload. Checked on focus, not
  // just mount, so someone returning from the paywall isn't still gated.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      getApiClient()
        .getQuota()
        .then((quota) => {
          if (active) setPlanState(quota.plan === "free" ? "free" : "paid");
        })
        .catch(() => {
          // Offline or not signed in. Let them try — the server enforces the
          // plan either way, and its answer is shown below.
          if (active) setPlanState("unknown");
        });

      return () => {
        active = false;
      };
    }, [])
  );

  /**
   * Photograph the affected part and have the server assess it.
   *
   * There is no local fallback. An early version waited two seconds and
   * reported "healthy, 95% confident" for any photo at all.
   */
  const handleAnalyzePhoto = async () => {
    if (phase !== "idle") return;

    setError(null);
    setPhase("capturing");

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });

      if (!photo?.uri) {
        throw new ApiError("Couldn't take that photo. Try again.", 0, true);
      }

      setPhase("analysing");

      // Same pipeline as identification: downscaled and stripped of EXIF
      // before it leaves the phone.
      const capture = await holdCapture(photo.uri, "");

      setDiagnosis(
        await getApiClient().diagnose(
          [toIdentificationImage(capture)],
          capture.hash,
          plantId || undefined
        )
      );
    } catch (err) {
      const apiError =
        err instanceof ApiError ? err : new ApiError("Something went wrong. Try again.", 0, true);

      if (apiError.code === ErrorCode.PremiumRequired || apiError.status === 403) {
        setPlanState("free");
      } else {
        setError(apiError);
      }
    } finally {
      setPhase("idle");
    }
  };

  // Every state gets a way out. Only the error state had a Back button, so
  // the camera, permission and results screens could only be left by a
  // swipe gesture most people don't know is there.
  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={goBack}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Check plant health</Text>
      {plantName ? <Text style={styles.subtitle}>{plantName}</Text> : null}
    </View>
  );

  if (planState === "checking" || phase === "analysing") {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.leaf} />
          {phase === "analysing" ? (
            <Text style={styles.loadingText}>Looking at the leaves…</Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (planState === "free") {
    return (
      <ScrollView style={styles.container}>
        {header}
        <View style={styles.body}>
          <Text style={styles.statusTitle}>Health checks are part of Premium</Text>
          <Text style={styles.bodyText}>
            Photograph a leaf that looks wrong and Sorrel suggests the most likely causes, with
            what to try first.
          </Text>
          <Text style={styles.bodyText}>
            Your free identifications, care notes and watering reminders carry on either way.
          </Text>
          <View style={styles.actionsSection}>
            <Button label="See Premium" onPress={() => router.push("/subscription")} />
            <SecondaryButton label="Not now" onPress={goBack} style={styles.secondaryAction} />
          </View>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container}>
        {header}
        <View style={styles.body}>
          <Text style={styles.statusTitle}>Couldn't check this one</Text>
          <Text style={styles.bodyText}>{error.message}</Text>
          <View style={styles.actionsSection}>
            {/* A retry only where one could plausibly work. */}
            {error.retryable ? (
              <Button label="Try again" onPress={() => setError(null)} />
            ) : (
              <Button label="Back" onPress={goBack} />
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  if (diagnosis) {
    const likelihood = diagnosis.isHealthy
      ? diagnosis.healthyProbability
      : 1 - diagnosis.healthyProbability;

    return (
      <ScrollView style={styles.container}>
        {header}

        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>
            {diagnosis.isHealthy ? "Looks healthy" : "Something looks wrong"}
          </Text>
          <Text style={styles.confidence}>
            {describeLikelihood(likelihood)} · {Math.round(likelihood * 100)}%
            {diagnosis.cached ? " · from an earlier check" : ""}
          </Text>
        </View>

        {diagnosis.diseases.length > 0 && (
          <View style={styles.diseasesSection}>
            {/* The provider suggests conditions even for a healthy plant.
                Calling those "most likely causes" of a problem it just said
                isn't there would contradict the headline. */}
            <Text style={styles.sectionTitle}>
              {diagnosis.isHealthy ? "Worth ruling out" : "Most likely causes"}
            </Text>

            {diagnosis.diseases.map((disease) => (
              <DiseaseCard key={disease.id} disease={disease} />
            ))}
          </View>
        )}

        {/* SPEC §10: guidance, not a pathology lab. */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This is guidance, not a plant pathology lab. If several causes look similar, change one
            thing at a time and give it a week before judging.
          </Text>
        </View>

        <View style={styles.actionsSection}>
          <Button label="Check another photo" onPress={() => setDiagnosis(null)} />
          <SecondaryButton label="Done" onPress={goBack} style={styles.secondaryAction} />
        </View>
      </ScrollView>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.leaf} style={styles.loadingContainer} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.body}>
          <Text style={styles.icon}>🔍</Text>
          {permission.canAskAgain ? (
            <>
              <Text style={styles.bodyText}>
                Sorrel needs your camera to look at the affected leaves.
              </Text>
              <Button label="Allow camera" onPress={() => void requestPermission()} />
            </>
          ) : (
            <>
              {/* After a refusal iOS never shows the prompt again, so a
                  request button would do nothing at all. */}
              <Text style={styles.bodyText}>
                Camera access is turned off for Sorrel. You can turn it back on in Settings.
              </Text>
              <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      {/* Controls sit beside the camera, not inside it: children of
          CameraView don't reliably receive touches under the new
          architecture. */}
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        <View style={styles.tipsOverlay} pointerEvents="none">
          <Text style={styles.tipsTitle}>Get close to the problem</Text>
          <Text style={styles.tip}>• Fill the frame with the affected leaf</Text>
          <Text style={styles.tip}>• Good light, no harsh shadows</Text>
          <Text style={styles.tip}>• Include the underside if you see pests</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Take photo"
          onPress={handleAnalyzePhoto}
          loading={phase === "capturing"}
          disabled={phase !== "idle"}
        />
      </View>
    </View>
  );
}

function DiseaseCard({ disease }: { disease: DiseaseFinding }) {
  const treatment = disease.treatment;

  return (
    <View style={styles.diseaseItem}>
      <View style={styles.diseaseHeader}>
        <Text style={styles.diseaseName}>{disease.name}</Text>
        <Text style={styles.diseaseLikelihood}>{Math.round(disease.probability * 100)}%</Text>
      </View>

      {disease.description ? (
        <Text style={styles.diseaseDescription}>{disease.description}</Text>
      ) : null}

      {/* The provider sends biological, chemical and prevention advice.
          Only prevention was shown, under the heading "What to do" — which
          is what to do next time, not about the problem in front of you. */}
      <TreatmentList label="Try first" steps={treatment?.biological} />
      <TreatmentList
        label="If that doesn't help"
        steps={treatment?.chemical}
        caution="Use any product exactly as its label says, and keep treated plants away from pets and children."
      />
      <TreatmentList label="Stop it coming back" steps={treatment?.prevention} />
    </View>
  );
}

function TreatmentList({
  label,
  steps,
  caution,
}: {
  label: string;
  steps?: string[];
  caution?: string;
}) {
  if (!steps?.length) return null;

  return (
    <View style={styles.treatmentBlock}>
      <Text style={styles.treatmentLabel}>{label}</Text>
      {steps.map((step, index) => (
        <View key={index} style={styles.recommendationItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.recommendationText}>{step}</Text>
        </View>
      ))}
      {caution ? <Text style={styles.caution}>{caution}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  backButton: {
    fontSize: Typography.body.fontSize,
    color: Colors.leaf,
    fontWeight: "600" as any,
    marginBottom: Spacing.compact,
  },
  title: {
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight as any,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
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
  body: {
    padding: Spacing.loose,
  },
  icon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: Spacing.loose,
  },
  bodyText: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.default,
  },
  cameraWrap: {
    flex: 1,
    overflow: "hidden",
  },
  tipsOverlay: {
    position: "absolute",
    top: Spacing.default,
    left: Spacing.default,
    right: Spacing.default,
    backgroundColor: "rgba(12, 42, 31, 0.78)",
    borderRadius: 10,
    padding: Spacing.default,
  },
  tipsTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: "#FFFFFF",
    marginBottom: Spacing.compact,
  },
  tip: {
    fontSize: Typography.body.fontSize,
    color: "rgba(255, 255, 255, 0.85)",
    marginBottom: Spacing.tight,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: Spacing.spacious,
    paddingHorizontal: Spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
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
    textAlign: "center",
  },
  diseasesSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  sectionTitle: {
    fontSize: Typography.subheadline.fontSize,
    fontWeight: Typography.subheadline.fontWeight as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.default,
  },
  // A column. This was a row with space-between, which laid the name,
  // description and treatment side by side in one squashed line.
  diseaseItem: {
    paddingVertical: Spacing.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass,
  },
  diseaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  diseaseName: {
    flex: 1,
    marginRight: Spacing.default,
    fontSize: Typography.body.fontSize,
    fontWeight: "600" as any,
    color: Colors.textPrimary,
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
    fontWeight: "600" as any,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  recommendationItem: {
    flexDirection: "row",
    marginBottom: Spacing.compact,
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
  caution: {
    ...Typography.caption1,
    color: Colors.toxicity,
    marginTop: Spacing.tight,
  },
  disclaimer: {
    marginHorizontal: Spacing.default,
    padding: Spacing.default,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  disclaimerText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  actionsSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  secondaryAction: {
    marginTop: Spacing.default,
  },
});
