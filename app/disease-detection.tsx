import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, Pressable } from "react-native";
import { useState, useRef, useCallback } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Radius, Shadow, Spacing, Tiles, Typography, type Palette } from "@constants/theme";
import { useColors, useThemedStyles } from "@hooks/useTheme";
import { Button } from "@components/Button";
import { ConfidenceMeter } from "@components/ConfidenceMeter";
import { HeroCard } from "@components/HeroCard";
import { IconTile } from "@components/ListGroup";
import { ScreenHeader } from "@components/ScreenHeader";
import { getApiClient, ApiError, ErrorCode, DiagnosisResponse, DiseaseFinding } from "@services/apiClient";
import { holdCapture, toIdentificationImage } from "@services/capture";
import { mapConfidenceBand } from "@services/identification";
import { useGoBack } from "@hooks/useGoBack";

/** "checking" until the server says; "unknown" when it can't be reached. */
type PlanState = "checking" | "free" | "paid" | "unknown";

/** Capturing keeps the camera mounted while takePictureAsync runs. */
type Phase = "idle" | "capturing" | "analysing";

export default function DiseaseDetectionScreen() {
  const Colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useGoBack("/my-plants");
  const { plantName } = useLocalSearchParams<{ plantId?: string; plantName?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [planState, setPlanState] = useState<PlanState>("checking");
  const [phase, setPhase] = useState<Phase>("idle");
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Health checks are Premium: say so before the photo, not after the
  // upload. Checked on focus so someone back from the paywall isn't gated.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      getApiClient()
        .getQuota()
        .then((quota) => {
          if (active) setPlanState(quota.plan === "free" ? "free" : "paid");
        })
        .catch(() => {
          // Offline or signed out: let them try; the server enforces the plan.
          if (active) setPlanState("unknown");
        });

      return () => {
        active = false;
      };
    }, [])
  );

  /** No local fallback: an early version reported "healthy, 95%" for any photo. */
  const handleAnalyzePhoto = async () => {
    if (phase !== "idle") return;

    setError(null);
    setPhase("capturing");

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new ApiError("Couldn't take that photo. Try again.", 0, true);

      setPhase("analysing");

      // Same pipeline as identification: downscaled, EXIF stripped.
      const capture = await holdCapture(photo.uri, "");
      setDiagnosis(await getApiClient().diagnose([toIdentificationImage(capture)], capture.hash));
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError("Something went wrong. Try again.", 0, true);

      if (apiError.code === ErrorCode.PremiumRequired || apiError.status === 403) {
        setPlanState("free");
      } else {
        setError(apiError);
      }
    } finally {
      setPhase("idle");
    }
  };

  const header = <ScreenHeader onBack={goBack} title="Plant health" subtitle={plantName || undefined} />;

  if (planState === "checking" || phase === "analysing") {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={Colors.brand} />
          {phase === "analysing" ? <Text style={styles.loadingText}>Looking at the leaves…</Text> : null}
        </View>
      </View>
    );
  }

  if (planState === "free") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {header}
        <HeroCard style={styles.gate} illustrationStyle={{ right: -70, bottom: -50, width: 220, height: 198 }}>
          <IconTile icon="stethoscope" color="rgba(255,255,255,0.18)" size={48} />
          <Text style={styles.gateTitle}>Health checks are part of Premium</Text>
          <Text style={styles.gateBody}>
            Photograph a leaf that looks wrong and Sorrel suggests the most likely causes, with what to try first.
          </Text>
          <Button label="See Premium" variant="inverse" icon="crown.fill" onPress={() => router.push("/subscription")} style={styles.gateButton} />
        </HeroCard>
        <Text style={styles.gateFine}>Your free identifications, care notes and reminders carry on either way.</Text>
        <Button label="Not now" variant="tertiary" onPress={goBack} />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.stateCard}>
          <IconTile icon="exclamationmark.triangle.fill" color={Tiles.red} size={52} />
          <Text style={styles.stateTitle}>Couldn't check this one</Text>
          <Text style={styles.stateBody}>{error.message}</Text>
          {/* A retry only where one could plausibly work. */}
          <Button
            label={error.retryable ? "Try again" : "Back"}
            onPress={error.retryable ? () => setError(null) : goBack}
            style={styles.stateButton}
          />
        </View>
      </View>
    );
  }

  if (diagnosis) {
    const likelihood = diagnosis.isHealthy ? diagnosis.healthyProbability : 1 - diagnosis.healthyProbability;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {header}

        <View style={styles.status}>
          <IconTile
            icon={diagnosis.isHealthy ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"}
            color={diagnosis.isHealthy ? Tiles.green : Tiles.orange}
            size={52}
          />
          <Text style={styles.statusTitle}>{diagnosis.isHealthy ? "Looks healthy" : "Something looks wrong"}</Text>
          {/* Same thresholds as identification, so one number never reads two ways. */}
          <View style={styles.statusMeter}>
            <ConfidenceMeter band={mapConfidenceBand(likelihood)} score={likelihood} />
          </View>
          {diagnosis.cached ? <Text style={styles.statusFine}>From an earlier check of this photo</Text> : null}
        </View>

        {diagnosis.diseases.length > 0 ? (
          <>
            {/* The provider suggests conditions even for a healthy plant;
                calling them "causes" would contradict the headline. */}
            <Text style={styles.sectionTitle}>{diagnosis.isHealthy ? "Worth ruling out" : "Most likely causes"}</Text>
            {diagnosis.diseases.map((disease) => (
              <DiseaseCard key={disease.id} disease={disease} />
            ))}
          </>
        ) : null}

        {/* SPEC §10: guidance, not a pathology lab. */}
        <Text style={styles.disclaimer}>
          This is guidance, not a plant pathology lab. If several causes look similar, change one thing at a time and give
          it a week before judging.
        </Text>

        <View style={styles.actions}>
          <Button label="Check another photo" icon="camera.fill" onPress={() => setDiagnosis(null)} />
          <Button label="Done" variant="tertiary" onPress={goBack} />
        </View>
      </ScrollView>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.brand} style={styles.centred} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.stateCard}>
          <IconTile icon="camera.fill" color={Tiles.green} size={52} />
          <Text style={styles.stateTitle}>Camera needed</Text>
          {/* After a refusal iOS never shows the prompt again. */}
          <Text style={styles.stateBody}>
            {permission.canAskAgain
              ? "Sorrel needs your camera to look at the affected leaves."
              : "Camera access is turned off for Sorrel. You can turn it back on in Settings."}
          </Text>
          <Button
            label={permission.canAskAgain ? "Allow camera" : "Open Settings"}
            onPress={permission.canAskAgain ? () => void requestPermission() : () => void Linking.openSettings()}
            style={styles.stateButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      {/* Controls beside the camera, not inside it: children of CameraView
          don't reliably receive touches. */}
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.tips} pointerEvents="none">
          <Text style={styles.tipsTitle}>Get close to the problem</Text>
          <Text style={styles.tip}>Fill the frame with the affected leaf, in good light. Include the underside if you see pests.</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Take photo" icon="camera.fill" onPress={handleAnalyzePhoto} loading={phase === "capturing"} disabled={phase !== "idle"} />
      </View>
    </View>
  );
}

function DiseaseCard({ disease }: { disease: DiseaseFinding }) {
  const styles = useThemedStyles(createStyles);
  const treatment = disease.treatment;

  return (
    <View style={styles.disease}>
      <View style={styles.diseaseHeader}>
        <Text style={styles.diseaseName}>{disease.name}</Text>
        <View style={styles.likelihood}>
          <Text style={styles.likelihoodText}>{Math.round(disease.probability * 100)}%</Text>
        </View>
      </View>

      {disease.description ? <Text style={styles.diseaseDescription}>{disease.description}</Text> : null}

      {/* Biological first, chemical as a fallback, then prevention — rather
          than only prevention under the heading "What to do". */}
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

function TreatmentList({ label, steps, caution }: { label: string; steps?: string[]; caution?: string }) {
  const styles = useThemedStyles(createStyles);
  if (!steps?.length) return null;

  return (
    <View style={styles.treatment}>
      <Text style={styles.treatmentLabel}>{label}</Text>
      {steps.map((step, index) => (
        <View key={index} style={styles.step}>
          <View style={styles.stepDot} />
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
      {caution ? <Text style={styles.caution}>{caution}</Text> : null}
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
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginTop: Spacing.default,
    },
    gate: {
      marginHorizontal: Spacing.default,
    },
    gateTitle: {
      ...Typography.display,
      color: "#FFFFFF",
      marginTop: Spacing.default,
      maxWidth: "80%",
    },
    gateBody: {
      ...Typography.body,
      lineHeight: 22,
      color: "rgba(255, 255, 255, 0.82)",
      marginTop: Spacing.tight,
      maxWidth: "78%",
    },
    gateButton: {
      alignSelf: "flex-start",
      paddingHorizontal: Spacing.loose,
      marginTop: Spacing.loose,
    },
    gateFine: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.default,
      paddingHorizontal: Spacing.loose,
    },
    stateCard: {
      margin: Spacing.default,
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
      lineHeight: 22,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    stateButton: {
      alignSelf: "stretch",
      marginTop: Spacing.default,
    },
    status: {
      marginHorizontal: Spacing.default,
      alignItems: "center",
      padding: Spacing.loose,
      borderRadius: Radius.xl,
      backgroundColor: Colors.card,
      ...Shadow.card,
    },
    statusTitle: {
      ...Typography.display,
      color: Colors.textPrimary,
      marginTop: Spacing.default,
    },
    statusMeter: {
      alignSelf: "stretch",
      marginTop: Spacing.loose,
    },
    statusFine: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginTop: Spacing.default - 4,
    },
    sectionTitle: {
      ...Typography.headline,
      color: Colors.textPrimary,
      marginHorizontal: Spacing.default,
      marginTop: Spacing.spacious,
      marginBottom: Spacing.default - 4,
    },
    disease: {
      marginHorizontal: Spacing.default,
      marginBottom: Spacing.default - 4,
      padding: Spacing.default,
      borderRadius: Radius.lg,
      backgroundColor: Colors.card,
    },
    diseaseHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.tight,
    },
    diseaseName: {
      ...Typography.subheadline,
      color: Colors.textPrimary,
      flex: 1,
    },
    likelihood: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.pill,
      backgroundColor: Colors.bg,
    },
    likelihoodText: {
      ...Typography.caption1,
      fontWeight: "700",
      color: Colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    diseaseDescription: {
      ...Typography.body,
      lineHeight: 22,
      color: Colors.textSecondary,
      marginTop: Spacing.tight,
    },
    treatment: {
      marginTop: Spacing.default,
    },
    treatmentLabel: {
      ...Typography.overline,
      color: Colors.brand,
      marginBottom: 6,
    },
    step: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.tight + 2,
      marginBottom: 6,
    },
    stepDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.brand,
      marginTop: 8,
    },
    stepText: {
      ...Typography.body,
      lineHeight: 22,
      color: Colors.textPrimary,
      flex: 1,
    },
    caution: {
      ...Typography.caption1,
      color: Colors.toxicity,
      marginTop: 4,
    },
    disclaimer: {
      ...Typography.caption1,
      color: Colors.textSecondary,
      marginHorizontal: Spacing.loose,
      marginTop: Spacing.default,
      textAlign: "center",
    },
    actions: {
      marginHorizontal: Spacing.default,
      marginTop: Spacing.loose,
      gap: Spacing.compact,
    },
    cameraWrap: {
      flex: 1,
      marginHorizontal: Spacing.default,
      borderRadius: Radius.xl,
      overflow: "hidden",
      backgroundColor: "#000000",
    },
    tips: {
      position: "absolute",
      top: Spacing.default - 4,
      left: Spacing.default - 4,
      right: Spacing.default - 4,
      padding: Spacing.default - 2,
      borderRadius: Radius.md,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    tipsTitle: {
      ...Typography.subheadline,
      color: "#FFFFFF",
    },
    tip: {
      ...Typography.caption1,
      color: "rgba(255, 255, 255, 0.88)",
      marginTop: 2,
    },
    footer: {
      padding: Spacing.default,
    },
  });
