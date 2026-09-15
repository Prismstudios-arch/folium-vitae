import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { AppearancePreference, ColorScheme, DarkColors, LightColors, Palette } from "@constants/theme";

/**
 * Light, Dark, or whatever the phone is set to.
 *
 * The preference itself is stored with the rest of the user's settings; this
 * only holds it while the app runs. The root layout hands over the saved value
 * before the first screen draws, and Settings updates both.
 */

interface ThemeValue {
  scheme: ColorScheme;
  colors: Palette;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
}

// Outside a provider (tests, isolated renders) everything is light.
const ThemeContext = createContext<ThemeValue>({
  scheme: "light",
  colors: LightColors,
  preference: "system",
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<AppearancePreference>("system");
  const system = useColorScheme();

  // Date pickers, alerts, switches and the keyboard are drawn by iOS from the
  // system appearance, not from our palette. Overriding it keeps them matching
  // a choice that differs from the phone's.
  useEffect(() => {
    if (Platform.OS === "web" || typeof Appearance.setColorScheme !== "function") return;
    Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
  }, [preference]);

  const scheme: ColorScheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: scheme === "dark" ? DarkColors : LightColors,
      preference,
      setPreference,
    }),
    [scheme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

const styleCache = new WeakMap<object, Partial<Record<ColorScheme, unknown>>>();

/**
 * A screen's stylesheet for the current palette.
 *
 * Each file's factory runs at most once per scheme and the result is shared,
 * so switching appearance rebuilds nothing more than it has to.
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { scheme, colors } = useContext(ThemeContext);

  let entry = styleCache.get(factory);
  if (!entry) {
    entry = {};
    styleCache.set(factory, entry);
  }

  if (!(scheme in entry)) {
    entry[scheme] = factory(colors);
  }

  return entry[scheme] as T;
}
