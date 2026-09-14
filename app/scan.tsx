import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { useGoBack } from "@hooks/useGoBack";
import { useCamera, runPreFlightChecks, PreFlightResult } from "@services/camera";
import { holdCapture } from "@services/capture";

type CaptureState = "idle" | "capturing" | "checking" | "failed" | "success";

const SCRIM = "rgba(0, 0, 0, 0.45)";

export default function ScanScreen() {
  const router = useRouter();
  // Onboarding arrives here with router.replace, leaving no history.
  const goBack = useGoBack("/");
  const { cameraRef, hasPermission, canAskAgain, requestCameraPermission, isTorchOn, toggleTorch, capturePhoto } =
    useCamera();

  const [state, setState] = useState<CaptureState>("idle");
  const [preFlightResult, setPreFlightResult] = useState<PreFlightResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission) {
      requestCameraPermission();
    }
  }, [hasPermission, requestCameraPermission]);

  // After a photo is sent off, this screen stays mounted underneath the
  // result, still in "success". Coming back — "Not right? Try again" — found
  // the shutter and library buttons disabled for good.
  useFocusEffect(
    useCallback(() => {
      setState("idle");
      setPreFlightResult(null);
      setError(null);
    }, [])
  );

  /** Anywhere the shutter is legitimately pressable. */
  const canCapture = state === "idle" || state === "failed";

  const handleCapture = async () => {
    if (!canCapture) return;

    setError(null);
    setPreFlightResult(null);
    setState("capturing");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const photo = await capturePhoto();
    if (!photo) {
      setError("That photo didn't take. Try again.");
      setState("failed");
      return;
    }

    setState("checking");

    const result = await runPreFlightChecks(photo.uri);
    setPreFlightResult(result);

    if (!result.passes) {
      setState("failed");
      return;
    }

    try {
      // Hold the image here and pass only its hash: the image is far too
      // large for a navigation param, and the hash is the server's cache key.
      const capture = await holdCapture(photo.uri, "");
      setState("success");
      router.push({ pathname: "/result", params: { imageHash: capture.hash } });
    } catch (err) {
      console.error("Failed to prepare photo:", err);
      setError("Couldn't prepare that photo. Try again.");
      setState("failed");
    }
  };

  /** SPEC §5 asks for a photo-library entry alongside the camera. */
  const handlePickFromLibrary = async () => {
    if (!canCapture) return;

    try {
      // No base64 here: holdCapture re-encodes from the file anyway, and a
      // full-resolution library photo as a base64 string is tens of
      // megabytes held in memory for nothing.
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (picked.canceled || !picked.assets[0]) return;

      setError(null);
      setPreFlightResult(null);
      setState("checking");

      // Library photos skip the blur and exposure checks: the user chose
      // this image deliberately, and rejecting a picture they already have
      // is not the same courtesy as warning them before a shot is wasted.
      const capture = await holdCapture(picked.assets[0].uri, "");

      setState("success");
      router.push({ pathname: "/result", params: { imageHash: capture.hash } });
    } catch (err) {
      console.error("Failed to pick image:", err);
      setError("Couldn't open that photo. Try another.");
      setState("failed");
    }
  };

  if (!hasPermission) {
    // Once someone has said no, iOS never shows the prompt again and
    // requesting silently does nothing — so offer Settings, and a way back.
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Icon name="camera.fill" size={30} />
        </View>
        <Text style={styles.permissionTitle}>Sorrel needs your camera</Text>
        <Text style={styles.permissionBody}>
          {canAskAgain
            ? "To identify a plant, we need to see it. Photos are only sent when you take one."
            : "Camera access is turned off for Sorrel. You can turn it back on in Settings."}
        </Text>
        <Button
          label={canAskAgain ? "Allow camera" : "Open Settings"}
          onPress={canAskAgain ? requestCameraPermission : () => void Linking.openSettings()}
          style={styles.permissionButton}
        />
        <TouchableOpacity onPress={goBack} style={styles.permissionBack} accessibilityRole="button">
          <Text style={styles.permissionBackText}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const busy = state === "capturing" || state === "checking" || state === "success";

  const message =
    state === "failed" && preFlightResult && preFlightResult.failureReasons.length > 0
      ? preFlightResult.failureReasons.join("\n")
      : error
        ? error
        : busy
          ? "Checking the photo…"
          : "Fill the frame with one plant, in good light";

  return (
    <View style={styles.container}>
      {/* The camera fills the screen and the controls sit on top as a
          sibling, rather than as its children. Children of CameraView render
          but do not reliably receive touches under the new architecture. */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={isTorchOn} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <RoundButton icon="xmark" label="Close" onPress={goBack} />
          <RoundButton
            icon={isTorchOn ? "bolt.fill" : "bolt.slash.fill"}
            label={isTorchOn ? "Turn torch off" : "Turn torch on"}
            onPress={toggleTorch}
            active={isTorchOn}
          />
        </View>

        {/* All four corners. Only the two on the left were drawn before, so
            the "frame" was a stray bracket on one side of the screen. */}
        <View style={styles.frameArea} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            {busy ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
          </View>
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {/* White on a dark scrim. Brown text straight on the camera feed
              was unreadable against most backgrounds. */}
          <View
            style={[styles.message, state === "failed" && styles.messageFailed]}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.messageText}>{message}</Text>
          </View>

          <View style={styles.controls}>
            <RoundButton
              icon="photo.on.rectangle"
              label="Choose a photo from your library"
              onPress={handlePickFromLibrary}
              disabled={!canCapture}
              large
            />

            <TouchableOpacity
              onPress={handleCapture}
              disabled={!canCapture}
              style={[styles.shutter, !canCapture && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            {/* Balances the row so the shutter stays centred. */}
            <View style={styles.controlSpacer} />
          </View>
        </View>
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
  large = false,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  large?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.roundButton,
        large && styles.roundButtonLarge,
        active && styles.roundButtonActive,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name={icon} size={large ? 24 : 20} color={active ? Colors.leaf : "#FFFFFF"} weight="semibold" />
    </TouchableOpacity>
  );
}

const FRAME_SIZE = 270;
const CORNER = 44;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.tight,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  roundButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  frameArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#FFFFFF",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 16,
  },
  bottom: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.default,
    gap: Spacing.loose,
  },
  message: {
    alignSelf: "center",
    backgroundColor: SCRIM,
    borderRadius: 18,
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.tight,
    maxWidth: "92%",
  },
  messageFailed: {
    backgroundColor: "rgba(193, 65, 43, 0.85)",
  },
  messageText: {
    ...Typography.caption1,
    color: "#FFFFFF",
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.loose,
  },
  controlSpacer: {
    width: 56,
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
  },
  disabled: {
    opacity: 0.45,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.loose,
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(45, 88, 66, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.loose,
  },
  permissionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  permissionBody: {
    ...Typography.body,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
  permissionButton: {
    alignSelf: "stretch",
    marginTop: Spacing.spacious,
  },
  permissionBack: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: Spacing.tight,
  },
  permissionBackText: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
  },
});
