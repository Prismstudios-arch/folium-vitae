/**
 * Sorrel design system, version 2.
 *
 * The first version leaned on warm cream grounds and soil-brown text. On a
 * phone it read as dated and low-contrast — secondary text the colour of
 * weak tea on beige boxes — which is a large part of why the app felt like a
 * beta. Version 2 keeps the brand but takes its green from the app icon, and
 * moves the neutrals to the crisp light greys and near-black text of Apple's
 * own apps, so the plants and the brand colour are what stand out.
 *
 * Token names from version 1 are kept, so nothing that imports them breaks;
 * their values changed. New code should prefer the semantic names (bg, card,
 * separator, brand…).
 */

// MARK: - Colors

const brand = {
  /** Primary actions, links, selected states. White text passes AA on it. */
  brand: "#1E7A52",
  /** Pressed states, text on tinted backgrounds. */
  brandDark: "#11573A",
  /** Hero surfaces — the icon's ground. */
  brandDeep: "#062A1E",
  /** The lit side of the icon's ground, for gradients. */
  brandLit: "#1F7A57",
  /** Icon tiles and selected rows. */
  brandTint: "#E6F3EC",
  /** Leaf highlight from the icon, for use on dark surfaces. */
  brandBright: "#8FD86F",
};

export const Colors = {
  ...brand,

  // Grounds
  bg: "#F3F5F4",
  card: "#FFFFFF",
  separator: "#E3E8E5",

  // Text
  textPrimary: "#0F1A15",
  textSecondary: "#5C6863",
  textDisabled: "#9AA5A0",
  textOnBrand: "#FFFFFF",

  // Semantic
  confident: brand.brand,
  probably: "#B7791F",
  notSure: "#6B7672",
  toxicity: "#B54A1C",
  error: "#D0402B",
  success: brand.brand,

  // Version 1 names, remapped
  leaf: brand.brand,
  leafLight: "#8FCDAA",
  cream: "#F3F5F4",
  glass: "#E3E8E5",
  soil: "#5C6863",
  background: "#F3F5F4",
  surface: "#FFFFFF",
} as const;

/** Tinted icon-tile backgrounds, for grouped lists. */
export const Tiles = {
  green: "#1E7A52",
  teal: "#138A8A",
  blue: "#2F6FD6",
  amber: "#D98A12",
  orange: "#E0651B",
  red: "#D0402B",
  purple: "#7A5AC8",
  grey: "#7C8783",
} as const;

// Dark palette, defined for when a dark design is built. The app is locked to
// light appearance until then (app.json userInterfaceStyle).
export const ColorsDark = {
  leaf: "#6FCB98",
  leafLight: "#2E6A4B",
  cream: "#0B120F",
  glass: "#26312C",
  soil: "#A9B4AF",
  textPrimary: "#EEF3F0",
  textSecondary: "#A9B4AF",
  textDisabled: "#6D7874",
  background: "#0B120F",
  error: "#F08B7B",
  success: "#6FCB98",
} as const;

// MARK: - Spacing Grid (8pt base)

export const Spacing = {
  compact: 4,
  tight: 8,
  default: 16,
  loose: 24,
  spacious: 32,
  extra: 48,
} as const;

// MARK: - Shape

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** One soft shadow, used sparingly: cards floating over photos and heroes. */
export const Shadow = {
  card: {
    shadowColor: "#0B2A1C",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: "#0B2A1C",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

// MARK: - Typography
//
// Apple's type ramp, on the system font. Version 1 added positive tracking to
// the display sizes, which spaced headlines out like a 2010 web page.

export const Typography = {
  fontFamily: {
    default: "System",
  },

  /** Large title. */
  displayLarge: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
  /** Title 1. */
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
  /** Title 2. */
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
  /** Headline. */
  subheadline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  /** Footnote-ish: secondary lines under a row title. */
  caption1: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  /** Section labels above grouped lists. */
  overline: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
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
  springs: {
    /** Buttons and cards settling. */
    standard: { damping: 18, stiffness: 260, mass: 1 },
    /** Capture confirmation, success moments. */
    playful: { damping: 12, stiffness: 180, mass: 1 },
  },
  durations: {
    fast: 180,
    standard: 280,
    slow: 480,
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
  button: {
    minHeight: 54,
    borderRadius: Radius.md + 2,
    paddingHorizontal: Spacing.default,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.default,
  },
  icon: {
    small: 16,
    medium: 24,
    large: 32,
  },
} as const;
