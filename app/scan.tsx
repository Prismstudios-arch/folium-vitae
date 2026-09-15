import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import type { SFSymbol } from "expo-symbols";
import { Colors, Radius, Spacing, Tiles, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { Icon } from "@components/Icon";
import { IconTile } from "@components/ListGroup";
import { useGoBack } from "@hooks/useGoBack";
import { useCamera, runPreFlightChecks, PreFlightResult } from "@services/camera";
import { holdCapture } from "@services/capture";

type CaptureState = "idle" | "capturing" | "checking" | "failed" | "success";

const SCRIM = "rgba(0, 0, 0, 0.42)";
const FRAME_SIZE = 272;
const CORNER = 46;
const CORNER_WIDTH = 4;

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // After a photo is sent off, this screen stays mounted under the result in
  // "success". Coming back used to find the shutter disabled for good.
  useFocusEffect(
    useCallback(() => {
      setState("idle");
      setPreFlightResult(null);
      setError(null);
    }, [])
  );

  const canCapture = state === "idle" || state === "failed";
  const busy = state === "capturing" || state === "checking" || state === "success";

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
      // No base64: holdCapture re-encodes from the file anyway.
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (picked.canceled || !picked.assets[0]) return;

      setError(null);
      setPreFlightResult(null);
      setState("checking");

      // Library photos skip the blur and exposure checks: the user chose
      // this image deliberately.
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
      <View style={[styles.permission, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.default }]}>
        <StatusBar style="dark" />
        <View style={styles.permissionBody}>
          <IconTile icon="camera.fill" color={Tiles.green} size={64} />
          <Text style={styles.permissionTitle}>Sorrel needs your camera</Text>
          <Text style={styles.permissionText}>
            {canAskAgain
              ? "To identify a plant, we need to see it. Photos are only sent when you take one."
              : "Camera access is turned off for Sorrel. You can turn it back on in Settings."}
          </Text>
        </View>
        <Button
          label={canAskAgain ? "Allow camera" : "Open Settings"}
          icon={canAskAgain ? "camera.fill" : "gearshape.fill"}
          onPress={canAskAgain ? requestCameraPermission : () => void Linking.openSettings()}
        />
        <Pressable onPress={goBack} style={styles.permissionBack} accessibilityRole="button">
          <Text style={styles.permissionBackText}>Not now</Text>
        </Pressable>
      </View>
    );
  }

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
      <StatusBar style="light" />

      {/* The camera fills the screen and the controls sit on top as a
          sibling: children of CameraView don't reliably receive touches. */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={isTorchOn} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.tight }]}>
          <RoundButton icon="xmark" label="Close" onPress={goBack} />
          <View style={styles.titlePill} pointerEvents="none">
            <Text style={styles.titlePillText}>Identify a plant</Text>
          </View>
          <RoundButton
            icon={isTorchOn ? "bolt.fill" : "bolt.slash.fill"}
            label={isTorchOn ? "Turn torch off" : "Turn torch on"}
            onPress={toggleTorch}
            active={isTorchOn}
          />
        </View>

        <View style={styles.frameArea} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTopLeft, busy && styles.cornerBusy]} />
            <View style={[styles.corner, styles.cornerTopRight, busy && styles.cornerBusy]} />
            <View style={[styles.corner, styles.cornerBottomLeft, busy && styles.cornerBusy]} />
            <View style={[styles.corner, styles.cornerBottomRight, busy && styles.cornerBusy]} />
            {busy ? <ScanLine /> : null}
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.default }]} pointerEvents="box-none">
          {/* White on a dark scrim: brown text on the camera feed was
              unreadable against most backgrounds. */}
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

            <Pressable
              onPress={handleCapture}
              disabled={!canCapture}
              style={({ pressed }) => [styles.shutter, !canCapture && styles.disabled, pressed && styles.shutterPressed]}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <View style={styles.shutterInner} />
            </Pressable>

            {/* Balances the row so the shutter stays centred. */}
            <View style={styles.controlSpacer} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** A line sweeping the frame while the photo is checked. */
function ScanLine() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * (FRAME_SIZE - 24) }],
  }));

  return <Animated.View style={[styles.scanLine, style]} />;
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
  large = false,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  large?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.roundButton,
        large && styles.roundButtonLarge,
        active && styles.roundButtonActive,
        disabled && styles.disabled,
        pressed && styles.roundButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name={icon} size={large ? 24 : 19} color={active ? Colors.brandDeep : "#FFFFFF"} weight="semibold" />
    </Pressable>
  );
}

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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.default,
  },
  titlePill: {
    paddingHorizontal: Spacing.default - 2,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: SCRIM,
  },
  titlePillText: {
    ...Typography.controlSmall,
    color: "#FFFFFF",
    fontWeight: "600",
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
    backgroundColor: Colors.brandBright,
  },
  roundButtonPressed: {
    opacity: 0.7,
  },
  frameArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#FFFFFF",
  },
  cornerBusy: {
    borderColor: Colors.brandBright,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 18,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 18,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 18,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.brandBright,
    shadowColor: Colors.brandBright,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  bottom: {
    paddingHorizontal: Spacing.default,
    gap: Spacing.loose,
  },
  message: {
    alignSelf: "center",
    backgroundColor: SCRIM,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.default,
    paddingVertical: Spacing.tight,
    maxWidth: "92%",
  },
  messageFailed: {
    backgroundColor: "rgba(208, 64, 43, 0.9)",
    borderRadius: Radius.md,
  },
  messageText: {
    ...Typography.caption1,
    fontWeight: "500",
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
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#FFFFFF",
  },
  disabled: {
    opacity: 0.45,
  },
  permission: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.loose,
  },
  permissionBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.tight,
  },
  permissionTitle: {
    ...Typography.display,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.loose,
  },
  permissionText: {
    ...Typography.bodyLarge,
    lineHeight: 24,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  permissionBack: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.tight,
  },
  permissionBackText: {
    ...Typography.bodyLarge,
    color: Colors.brand,
    fontWeight: "600",
  },
});
