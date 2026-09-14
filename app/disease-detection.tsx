import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useState, useRef, useCallback } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button, SecondaryButton } from "@components/Button";
import { Icon } from "@components/Icon";
import { ScreenHeader } from "@components/ScreenHeader";
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
 * Capturing keeps the camera mounted. An earlier version swapped the camera
 * for a spinner the instant the shutter was pressed, unmounting the view
 * while takePictureAsync was still using it.
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
  const { plantName } = useLocalSearchParams<{ plantId?: string; plantName?: string }>();

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
          // plan either way, and its answer is shown.
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

      setDiagnosis(await getApiClient().diagnose([toIdentificationImage(capture)], capture.hash));
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

  // Every state gets a way out.
  const header = (
    <ScreenHeader onBack={goBack} title="Check plant health" subtitle={plantName || undefined} />
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
          <View style={styles.featureIcon}>
            <Icon name="stethoscope" size={30} />
          </View>
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
          <Icon
            name={diagnosis.isHealthy ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"}
            size={36}
            color={diagnosis.isHealthy ? Colors.leaf : Colors.toxicity}
          />
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
          <View style={styles.featureIcon}>
            <Icon name="camera.fill" size={30} />
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.default,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.default,
    color: Colors.textSecondary,
  },
  body: {
    paddingHorizontal: Spacing.loose,
    paddingTop: Spacing.default,
  },
  featureIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.loose,
  },
  bodyText: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 14,
    padding: Spacing.default,
  },
  tipsTitle: {
    ...Typography.subheadline,
    color: "#FFFFFF",
    marginBottom: Spacing.compact,
  },
  tip: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.88)",
    marginBottom: Spacing.compact,
  },
  footer: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.default,
  },
  statusContainer: {
    alignItems: "center",
    gap: Spacing.tight,
    paddingVertical: Spacing.loose,
    paddingHorizontal: Spacing.default,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glass,
  },
  statusTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  confidence: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  diseasesSection: {
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.loose,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  // A column. This was once a row with space-between, which laid the name,
  // description and treatment side by side in one squashed line.
  diseaseItem: {
    paddingVertical: Spacing.default,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glass,
  },
  diseaseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  diseaseName: {
    ...Typography.subheadline,
    flex: 1,
    marginRight: Spacing.default,
    color: Colors.textPrimary,
  },
  diseaseLikelihood: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  diseaseDescription: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginTop: Spacing.tight,
  },
  treatmentBlock: {
    marginTop: Spacing.default,
  },
  treatmentLabel: {
    ...Typography.caption1,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  recommendationItem: {
    flexDirection: "row",
    marginBottom: Spacing.compact,
  },
  bullet: {
    ...Typography.body,
    color: Colors.leaf,
    marginRight: Spacing.tight,
    fontWeight: "700",
  },
  recommendationText: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textPrimary,
    flex: 1,
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
    borderRadius: 12,
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
