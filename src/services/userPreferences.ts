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

const PREFS_KEY = "verdure_user_preferences";

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
  try {
    const prefs = await getUserPreferences();
    // In Phase 2, would also export database
    const data = {
      preferences: prefs,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error("Failed to export data:", error);
    throw error;
  }
}
