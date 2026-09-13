/**
 * Sorrel Design System
 * Color palette, spacing, typography, motion
 * Matches DESIGN.md exactly
 */

// MARK: - Colors

export const Colors = {
  // Primary Palette
  leaf: "#2D5842", // Deep sage green — trust, growth
  leafLight: "#A8C4B4", // Desaturated sage — active control tracks, tints
  cream: "#FDFBF8", // Off-white with yellow undertone
  glass: "#E8E5E0", // Soft grey-brown — borders, dividers
  soil: "#8B7355", // Warm brown — secondary text

  // Semantic Colors
  confident: "#2D5842", // Same as leaf
  probably: "#B8860B", // Goldenrod
  notSure: "#8B7355", // Same as soil
  toxicity: "#A0522D", // Sienna

  // Text Colors
  textPrimary: "#1A1A1A",
  textSecondary: "#8B7355", // Same as soil
  textDisabled: "#C5BFB5",

  // Background Colors
  background: "#FDFBF8", // Same as cream
  surface: "rgba(232, 229, 224, 0.3)", // Glass with opacity

  // Status Colors
  error: "#C1412B", // Rust red
  success: "#2D5842", // Same as leaf
} as const;

// Dark mode colors (override above in dark context)
export const ColorsDark = {
  leaf: "#A8D5BA", // Light green
  leafLight: "#3E6B54", // Sage that reads as "on" against the dark ground
  cream: "#0F0D0A", // Deep charcoal
  glass: "#423A32", // Glass inverted
  soil: "#C8B89D", // Soil lightened
  textPrimary: "#F5F3F0",
  textSecondary: "#C8B89D",
  textDisabled: "#7A7569",
  background: "#0F0D0A",
  error: "#F4A9A3", // Light coral
  success: "#A8D5BA", // Light green
} as const;

// MARK: - Spacing Grid (8pt base)

export const Spacing = {
  compact: 4, // Between inline elements
  tight: 8, // Padding inside small components
  default: 16, // Standard margin, padding
  loose: 24, // Between sections
  spacious: 32, // Between major sections
  extra: 48, // Screen-edge breathing room
} as const;

// MARK: - Typography

export const Typography = {
  // Font family
  fontFamily: {
    default: "System", // Native system font (SF Pro on iOS, Roboto on Android)
  },

  // Display Sizes
  displayLarge: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600" as const, // Semibold
    letterSpacing: 1,
  },
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },

  // Headline Sizes
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
    letterSpacing: 0,
  },
  subheadline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
    letterSpacing: 0,
  },

  // Body Sizes
  bodyLarge: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const, // Regular
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "400" as const,
    letterSpacing: 0.2,
  },

  // Caption Sizes
  caption1: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500" as const, // Medium
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    letterSpacing: 0.3,
  },

  // Button/UI
  button: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  controlSmall: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
} as const;

// MARK: - Motion

export const Motion = {
  // Spring animations
  springs: {
    standard: {
      damping: 0.7,
      mass: 1,
      stiffness: 0.8,
      overshootClamping: false,
    },
    playful: {
      damping: 0.8,
      mass: 1,
      stiffness: 0.6,
      overshootClamping: false,
    },
  },

  // Durations (ms)
  durations: {
    fast: 200,
    standard: 300,
    slow: 500,
  },
} as const;

// MARK: - Haptics

export const Haptics = {
  captureShutter: "light" as const,
  focusLocked: "selection" as const,
  success: "success" as const,
  warning: "warning" as const,
} as const;

// MARK: - Component Presets

export const ComponentStyles = {
  // Button sizes
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: Spacing.default,
  },

  // Card styles
  card: {
    borderRadius: 12,
    padding: Spacing.default,
  },

  // Icon sizes
  icon: {
    small: 16,
    medium: 24,
    large: 32,
  },
} as const;
