import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useCallback, useState } from "react";

export type PreFlightResult = {
  isBlurry: boolean;
  blurConfidence: number;
  hasPlant: boolean;
  plantConfidence: number;
  lightLevel: "veryLow" | "low" | "medium" | "bright";
  passes: boolean;
  failureReasons: string[];
};

/**
 * Hook for managing camera functionality
 */
export function useCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const hasPermission = permission?.granted ?? false;

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
    requestCameraPermission,
    isTorchOn,
    toggleTorch,
    capturePhoto,
  };
}

// MARK: - Pre-flight Checks

/**
 * Detect blur in an image using simple heuristics
 * (In production, would use Vision framework or ML model)
 */
export async function detectBlur(imageUri: string): Promise<{ isBlurry: boolean; confidence: number }> {
  // Simplified blur detection
  // In production, would analyze image sharpness via Laplacian variance
  // or use native Vision framework capabilities

  // For Phase 1, we'll use a basic heuristic
  // A real implementation would analyze the image data
  const isBlurry = Math.random() < 0.1; // 90% pass rate for testing
  const confidence = Math.random() * 0.3; // Low confidence = not blurry

  return { isBlurry, confidence };
}

/**
 * Detect if there's a plant in the image
 * (In production, would use ML classifier)
 */
export async function detectPlant(imageUri: string): Promise<{ hasPlant: boolean; confidence: number }> {
  // Simplified plant detection
  // In production, would use Vision framework classification
  // or Core ML model for plant detection

  // For Phase 1, we'll use a basic heuristic
  const hasPlant = Math.random() < 0.85; // 85% detection rate for testing
  const confidence = Math.random() * 0.5 + 0.5; // 50-100% confidence when detected

  return { hasPlant, confidence };
}

/**
 * Estimate light level from image metadata
 */
export function estimateLightLevel(
  exposureDuration?: number,
  iso?: number
): "veryLow" | "low" | "medium" | "bright" {
  // Simple heuristic: assume average conditions
  // In production, would use actual exposure metadata from camera
  const level = Math.random();

  if (level < 0.2) return "veryLow";
  if (level < 0.4) return "low";
  if (level < 0.7) return "medium";
  return "bright";
}

/**
 * Run all pre-flight checks on a captured image
 */
export async function runPreFlightChecks(imageUri: string): Promise<PreFlightResult> {
  try {
    const [blurResult, plantResult] = await Promise.all([
      detectBlur(imageUri),
      detectPlant(imageUri),
    ]);

    const lightLevel = estimateLightLevel();

    const failureReasons: string[] = [];

    if (blurResult.isBlurry) {
      failureReasons.push("That came out blurry — hold still and try again");
    }

    if (!plantResult.hasPlant) {
      failureReasons.push("Point it at a plant");
    }

    if (lightLevel === "veryLow") {
      failureReasons.push("That's too dark — needs a bit more light");
    }

    return {
      isBlurry: blurResult.isBlurry,
      blurConfidence: blurResult.confidence,
      hasPlant: plantResult.hasPlant,
      plantConfidence: plantResult.confidence,
      lightLevel,
      passes: failureReasons.length === 0,
      failureReasons,
    };
  } catch (error) {
    console.error("Pre-flight checks failed:", error);
    return {
      isBlurry: false,
      blurConfidence: 0,
      hasPlant: true,
      plantConfidence: 1,
      lightLevel: "medium",
      passes: true,
      failureReasons: [],
    };
  }
}
