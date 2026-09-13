import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Colors, Spacing, Typography } from "@constants/theme";
import { Button } from "@components/Button";
import { useCamera, runPreFlightChecks, PreFlightResult } from "@services/camera";
import { holdCapture } from "@services/capture";

type CaptureState = "idle" | "focusing" | "capturing" | "checking" | "failed" | "success";

export default function ScanScreen() {
  const router = useRouter();
  const { cameraRef, hasPermission, requestCameraPermission, isTorchOn, toggleTorch, capturePhoto } =
    useCamera();

  const [state, setState] = useState<CaptureState>("idle");
  const [preFlightResult, setPreFlightResult] = useState<PreFlightResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestCameraPermission();
    }
  }, [hasPermission, requestCameraPermission]);

  /** Anywhere the shutter is legitimately pressable. */
  const canCapture = state === "idle" || state === "failed";

  const goBack = () => {
    // Onboarding reaches this screen with router.replace, which leaves no
    // history — back() then silently does nothing and the user is stuck.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleCapture = async () => {
    if (!canCapture) return;

    // Clear a previous failure, or the old reasons stay on screen behind
    // the new attempt.
    setError(null);
    setPreFlightResult(null);

    setState("capturing");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const photo = await capturePhoto();
    if (!photo) {
      setError("Failed to capture photo");
      setState("failed");
      return;
    }

    setCapturedImage(photo.uri);
    setState("checking");

    // Run pre-flight checks
    const result = await runPreFlightChecks(photo.uri);
    setPreFlightResult(result);

    if (result.passes) {
      setState("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Hold the image data here and pass only its hash. Base64 is far too
      // large for a navigation param, and the hash is what the server uses
      // as its cache key anyway.
      const capture = await holdCapture(photo.uri, photo.base64!);

      router.push({
        pathname: "/result",
        params: { imageHash: capture.hash },
      });
    } else {
      setState("failed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  /** SPEC §5 asks for a photo-library entry alongside the camera. */
  const handlePickFromLibrary = async () => {
    if (!canCapture) return;

    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });

      if (picked.canceled || !picked.assets[0]) return;

      const asset = picked.assets[0];
      setState("checking");

      // Library photos skip the blur and exposure checks: the user chose
      // this image deliberately, and rejecting a picture they already have
      // is not the same courtesy as warning them before a shot is wasted.
      const capture = await holdCapture(asset.uri, asset.base64 ?? "");

      setState("success");
      router.push({ pathname: "/result", params: { imageHash: capture.hash } });
    } catch (err) {
      console.error("Failed to pick image:", err);
      setError("Couldn't open your photos. Check Sorrel has permission in Settings.");
      setState("failed");
    }
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setPreFlightResult(null);
    setError(null);
    setState("idle");
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>Camera access required</Text>
        <Text style={styles.subtitle}>We need permission to identify plants</Text>
        <Button label="Enable Camera" onPress={requestCameraPermission} style={styles.marginTop} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* The camera fills the screen and the controls sit on top as a
          sibling, rather than as its children. Children of CameraView render
          but do not reliably receive touches under the new architecture,
          which leaves every control dead while the preview looks fine. */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={isTorchOn}
      />

      {/* pointerEvents="box-none" so the empty areas of the overlay do not
          swallow taps meant for the preview. */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.topButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.topButtonText}>←</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.topButton}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.topButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Scanning Animation & Guide */}
        {state === "capturing" || state === "checking" ? (
          <View style={styles.centerContent} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.leaf} style={styles.spinner} />
            <Text style={styles.scanningText}>Analysing photo…</Text>
          </View>
        ) : (
          <View style={styles.centerContent} pointerEvents="none">
            <CornerGuide position="topLeft" />
            <View style={styles.spacer} />
            <CornerGuide position="bottomLeft" />
          </View>
        )}

        {/* Status Bar */}
        <View style={styles.statusBar} pointerEvents="none">
          {state === "failed" && preFlightResult ? (
            <View style={styles.failureBox}>
              {preFlightResult.failureReasons.map((reason, idx) => (
                <Text key={idx} style={styles.failureText}>
                  • {reason}
                </Text>
              ))}
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.helpText}>Frame the plant clearly • Good lighting helps</Text>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={toggleTorch}
            style={styles.controlButton}
            accessibilityRole="button"
            accessibilityLabel={isTorchOn ? "Turn torch off" : "Turn torch on"}
          >
            {/* The off state was a pistol emoji. */}
            <Text style={styles.controlButtonText}>{isTorchOn ? "🔦" : "💡"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCapture}
            disabled={!canCapture}
            style={[styles.shutterButton, !canCapture && styles.shutterDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickFromLibrary}
            disabled={!canCapture}
            style={styles.controlButton}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
          >
            <Text style={styles.controlButtonText}>🖼️</Text>
          </TouchableOpacity>
        </View>

        {/* Retry Button */}
        {state === "failed" && (
          <View style={styles.retryBox}>
            <Button label="Retry" onPress={handleRetry} />
          </View>
        )}
      </View>
    </View>
  );
}

function CornerGuide({ position }: { position: "topLeft" | "bottomLeft" | "topRight" | "bottomRight" }) {
  return <View style={[styles.cornerGuide, styles[`corner_${position}`]]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.loose,
  },
  title: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.tight,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },

  // Top Bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.default,
    paddingTop: Spacing.default,
  },
  topButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  topButtonText: {
    fontSize: 18,
    color: Colors.leaf,
  },

  // Center Content
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  spacer: {
    height: 120,
  },
  spinner: {
    marginBottom: Spacing.default,
  },
  scanningText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption1.fontSize,
    marginTop: Spacing.tight,
  },

  // Corner Guides
  cornerGuide: {
    width: 40,
    height: 40,
    borderColor: Colors.leaf,
    borderWidth: 2,
  },
  corner_topLeft: {
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  corner_topRight: {
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  corner_bottomLeft: {
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  corner_bottomRight: {
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },

  // Status Bar
  statusBar: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.default,
    minHeight: 50,
    justifyContent: "center",
  },
  failureBox: {
    backgroundColor: "rgba(193, 65, 43, 0.1)",
    borderRadius: 8,
    padding: Spacing.default,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  failureText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption1.fontSize,
    marginBottom: Spacing.compact,
  },
  errorBox: {
    backgroundColor: "rgba(193, 65, 43, 0.1)",
    borderRadius: 8,
    padding: Spacing.default,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.caption1.fontSize,
  },
  helpText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption2.fontSize,
    textAlign: "center",
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: Spacing.default,
    paddingHorizontal: Spacing.default,
  },
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonText: {
    fontSize: 20,
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.leaf,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: Colors.glass,
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
  },

  // Retry Box
  retryBox: {
    paddingHorizontal: Spacing.default,
    paddingBottom: Spacing.default,
  },

  // Util
  marginTop: {
    marginTop: Spacing.spacious,
  },
});
