import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { useRef, useCallback, useState } from "react";
import {
  analyseGrayscale,
  toGrayscale,
  ImageQuality,
  LightLevel,
} from "./imageAnalysis";

export type PreFlightResult = {
  isBlurry: boolean;
  /** Laplacian variance. Higher is sharper. */
  sharpness: number;
  lightLevel: LightLevel;
  passes: boolean;
  failureReasons: string[];
  /**
   * True when the frame could not be analysed. The photo is allowed through
   * rather than blocked — but the caller is told the check did not run, so
   * nothing reports a pass it did not actually verify.
   */
  checksSkipped: boolean;
};

/**
 * Hook for managing camera functionality
 */
export function useCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const hasPermission = permission?.granted ?? false;
  // False once someone has refused: iOS will not show the prompt again and
  // requesting silently does nothing, so callers must offer Settings instead.
  const canAskAgain = permission?.canAskAgain ?? true;

  const requestCameraPermission = useCallback(async () => {
    const result = await requestPermission();
    return result.granted;
  }, [requestPermission]);

  const toggleTorch = useCallback(() => {
    setIsTorchOn(!isTorchOn);
  }, [isTorchOn]);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current) return null;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        // The provider downscales anyway and we pay per call by payload, so
        // there is nothing to gain from shipping a full-resolution frame.
        quality: 0.7,
        // Needed for identification: the proxy forwards bytes, not a file
        // path it has no way to read.
        base64: true,
        skipProcessing: false,
      });

      if (!photo?.base64) {
        console.error("Capture returned no image data");
        return null;
      }

      return photo;
    } catch (error) {
      console.error("Failed to capture photo:", error);
      return null;
    }
  }, []);

  return {
    cameraRef,
    hasPermission,
    canAskAgain,
    requestCameraPermission,
    isTorchOn,
    toggleTorch,
    capturePhoto,
  };
}

// MARK: - Pre-flight Checks

/**
 * Width the frame is normalised to before analysis.
 *
 * Sharpness is scale-dependent, so a fixed width keeps the threshold
 * meaningful across devices with different sensors. 96px is enough to
 * measure edge energy and small enough to decode in JavaScript in a few
 * milliseconds.
 */
const ANALYSIS_WIDTH = 96;

function base64ToBytes(base64: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (alphabet.indexOf(clean[i]) << 18) |
      (alphabet.indexOf(clean[i + 1]) << 12) |
      (alphabet.indexOf(clean[i + 2]) << 6) |
      alphabet.indexOf(clean[i + 3]);

    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
}

/**
 * Decode a small grayscale version of the capture.
 *
 * Returns null if the frame cannot be read, so callers can distinguish
 * "analysed and fine" from "could not analyse" instead of conflating them.
 */
export async function loadAnalysisFrame(
  imageUri: string
): Promise<{ gray: Float32Array; width: number; height: number } | null> {
  try {
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: ANALYSIS_WIDTH } }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!resized.base64) return null;

    const decoded = jpeg.decode(base64ToBytes(resized.base64), { useTArray: true });

    if (!decoded?.data || !decoded.width || !decoded.height) return null;

    return {
      gray: toGrayscale(decoded.data, decoded.width * decoded.height),
      width: decoded.width,
      height: decoded.height,
    };
  } catch (error) {
    console.warn("Could not decode frame for analysis:", error);
    return null;
  }
}

export async function analyseCapture(imageUri: string): Promise<ImageQuality | null> {
  const frame = await loadAnalysisFrame(imageUri);
  if (!frame) return null;

  return analyseGrayscale(frame.gray, frame.width, frame.height);
}

/**
 * Pre-flight checks.
 *
 * Two things are checked here and one deliberately is not. Sharpness and
 * exposure are measurable from the pixels. Whether the frame contains a
 * plant is not — that needs a classifier we do not ship, and the provider
 * already returns an is_plant probability which the server enforces. Asking
 * the user to "point it at a plant" based on a guess would be worse than not
 * asking at all.
 */
export async function runPreFlightChecks(imageUri: string): Promise<PreFlightResult> {
  const quality = await analyseCapture(imageUri);

  if (!quality) {
    // Could not analyse. Let the photo through — refusing to scan because
    // our own check failed would punish the user for our problem — but say
    // plainly that nothing was verified.
    return {
      isBlurry: false,
      sharpness: 0,
      lightLevel: LightLevel.Good,
      passes: true,
      failureReasons: [],
      checksSkipped: true,
    };
  }

  const failureReasons: string[] = [];

  if (quality.isBlurry) {
    failureReasons.push("That came out blurry — hold still and try again");
  }

  if (quality.light === LightLevel.TooDark) {
    failureReasons.push("That's too dark — needs a bit more light");
  }

  if (quality.light === LightLevel.BlownOut) {
    failureReasons.push("Too bright to make out — try moving out of direct sun");
  }

  return {
    isBlurry: quality.isBlurry,
    sharpness: quality.sharpness,
    lightLevel: quality.light,
    passes: failureReasons.length === 0,
    failureReasons,
    checksSkipped: false,
  };
}
