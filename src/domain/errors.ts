/**
 * Domain errors for Verdure
 * Honest, specific, actionable error messages
 */

export enum VerdureErrorType {
  // Identification
  IdentificationFailed = "IDENTIFICATION_FAILED",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  NoInternetConnection = "NO_INTERNET_CONNECTION",
  QuotaExceeded = "QUOTA_EXCEEDED",

  // Camera
  CameraAccessDenied = "CAMERA_ACCESS_DENIED",
  CameraNotAvailable = "CAMERA_NOT_AVAILABLE",
  CaptureSessionFailed = "CAPTURE_SESSION_FAILED",
  PhotoProcessingFailed = "PHOTO_PROCESSING_FAILED",

  // Pre-flight Checks
  ImageBlurred = "IMAGE_BLURRED",
  NoPlantDetected = "NO_PLANT_DETECTED",
  ImageTooDark = "IMAGE_TOO_DARK",
  ImageTooSmall = "IMAGE_TOO_SMALL",

  // Persistence
  DatabaseError = "DATABASE_ERROR",
  CorruptedData = "CORRUPTED_DATA",

  // Backend
  InvalidDeviceToken = "INVALID_DEVICE_TOKEN",
  ApiKeyMissing = "API_KEY_MISSING",
  UnauthorizedRequest = "UNAUTHORIZED_REQUEST",

  // Generic
  Unknown = "UNKNOWN",
}

export interface VerdureError {
  type: VerdureErrorType;
  message: string;
  description: string; // User-facing message (honest, specific, actionable)
  recovery?: string; // What to do next
  originalError?: Error; // For debugging
}

export function createError(
  type: VerdureErrorType,
  originalError?: Error
): VerdureError {
  const errorMessages: Record<VerdureErrorType, { description: string; recovery?: string }> = {
    [VerdureErrorType.IdentificationFailed]: {
      description: "Couldn't identify this plant",
      recovery: "Try a different angle or better lighting",
    },
    [VerdureErrorType.ProviderUnavailable]: {
      description: "The identification service is temporarily unavailable",
      recovery: "Check your internet connection and try again",
    },
    [VerdureErrorType.NoInternetConnection]: {
      description: "No internet connection",
      recovery: "Connect to WiFi or mobile data and try again",
    },
    [VerdureErrorType.QuotaExceeded]: {
      description: "You've reached your daily scan limit",
      recovery: "Your limit resets at midnight",
    },

    [VerdureErrorType.CameraAccessDenied]: {
      description: "Camera access was denied",
      recovery: "Enable camera access in Settings",
    },
    [VerdureErrorType.CameraNotAvailable]: {
      description: "Camera is not available on this device",
      recovery: "This app requires a camera",
    },
    [VerdureErrorType.CaptureSessionFailed]: {
      description: "Failed to start camera",
      recovery: "Try restarting the app",
    },
    [VerdureErrorType.PhotoProcessingFailed]: {
      description: "Couldn't process the photo",
      recovery: "Try a different photo",
    },

    [VerdureErrorType.ImageBlurred]: {
      description: "That came out blurry — hold still and try again",
      recovery: "Use both hands, rest your elbows",
    },
    [VerdureErrorType.NoPlantDetected]: {
      description: "Point it at a plant",
      recovery: "Make sure the plant is in frame and well-lit",
    },
    [VerdureErrorType.ImageTooDark]: {
      description: "That's too dark — needs a bit more light",
      recovery: "Move to a brighter spot or use the flashlight",
    },
    [VerdureErrorType.ImageTooSmall]: {
      description: "Photo is too small — move closer",
      recovery: "The plant should fill most of the frame",
    },

    [VerdureErrorType.DatabaseError]: {
      description: "Database error",
      recovery: "Try restarting the app",
    },
    [VerdureErrorType.CorruptedData]: {
      description: "Some data was corrupted",
      recovery: "Your data has been restored",
    },

    [VerdureErrorType.InvalidDeviceToken]: {
      description: "Device verification failed",
      recovery: "Try restarting the app",
    },
    [VerdureErrorType.ApiKeyMissing]: {
      description: "Configuration error",
      recovery: "This is a technical issue; please contact support",
    },
    [VerdureErrorType.UnauthorizedRequest]: {
      description: "Request was not authorized",
      recovery: "Try restarting the app",
    },

    [VerdureErrorType.Unknown]: {
      description: "Something went wrong",
      recovery: "Try again",
    },
  };

  const template = errorMessages[type] || errorMessages[VerdureErrorType.Unknown];

  return {
    type,
    message: originalError?.message || template.description,
    description: template.description,
    recovery: template.recovery,
    originalError,
  };
}

// Helper to check if error is recoverable
export function isRecoverable(error: VerdureError): boolean {
  const nonRecoverable = [
    VerdureErrorType.CameraNotAvailable,
    VerdureErrorType.ApiKeyMissing,
  ];
  return !nonRecoverable.includes(error.type);
}
