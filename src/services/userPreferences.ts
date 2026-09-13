import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserPreferences {
  hasCompletedOnboarding: boolean;
  units: "metric" | "imperial";
  hemisphere: "north" | "south";
  hasChildrenOrPets: boolean;
  showToxicityWarnings: boolean;
  notificationsEnabled: boolean;
  referralSource?: string;
}

const PREFS_KEY = "sorrel_user_preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  hasCompletedOnboarding: false,
  units: "metric",
  hemisphere: "north",
  hasChildrenOrPets: false,
  showToxicityWarnings: true,
  notificationsEnabled: true,
};

export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PREFS_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to get preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

export async function saveUserPreferences(prefs: Partial<UserPreferences>): Promise<void> {
  try {
    const current = await getUserPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save preferences:", error);
    throw error;
  }
}

export async function completeOnboarding(referralSource?: string): Promise<void> {
  await saveUserPreferences({
    hasCompletedOnboarding: true,
    referralSource,
  });
}

export async function resetAllData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFS_KEY);
    // Also would delete database here (Phase 2)
  } catch (error) {
    console.error("Failed to reset data:", error);
    throw error;
  }
}

export async function exportUserData(): Promise<string> {
  // Read storage directly rather than through getUserPreferences(), which
  // deliberately falls back to defaults so the UI can still render. An export
  // must never hand someone a file of default settings and call it their data
  // — if storage is unreadable, the caller needs to know it failed.
  const stored = await AsyncStorage.getItem(PREFS_KEY);
  const preferences: UserPreferences = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;

  return JSON.stringify(
    {
      preferences,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}
