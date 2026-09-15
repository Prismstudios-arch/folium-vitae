import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppearancePreference } from "@constants/theme";
import { deleteAllData, fetchAllPlants } from "./database";

export interface UserPreferences {
  hasCompletedOnboarding: boolean;
  units: "metric" | "imperial";
  hemisphere: "north" | "south";
  hasChildrenOrPets: boolean;
  showToxicityWarnings: boolean;
  notificationsEnabled: boolean;
  /** Absent in settings saved before there was a choice: follow the phone. */
  appearance?: AppearancePreference;
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

/**
 * Delete everything held on this device.
 *
 * This previously removed only the preferences key and reported success,
 * leaving every plant, photo and watering log in SQLite untouched — while
 * the UI told the user their data had been permanently deleted. The privacy
 * policy makes the same promise, so the claim was false in two places.
 *
 * The plants go first: if that fails we throw, and the user is told nothing
 * was deleted rather than being left with preferences gone and a collection
 * they were told had been removed.
 */
export async function resetAllData(): Promise<void> {
  await deleteAllData();
  await AsyncStorage.removeItem(PREFS_KEY);
}

export async function exportUserData(): Promise<string> {
  // Read storage directly rather than through getUserPreferences(), which
  // deliberately falls back to defaults so the UI can still render. An export
  // must never hand someone a file of default settings and call it their data
  // — if storage is unreadable, the caller needs to know it failed.
  const stored = await AsyncStorage.getItem(PREFS_KEY);
  const preferences: UserPreferences = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;

  // The collection is the part people actually care about, and it was
  // missing: this exported settings alone while the privacy policy promised
  // everything we hold.
  const plants = await fetchAllPlants();

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      preferences,
      plants,
    },
    null,
    2
  );
}
