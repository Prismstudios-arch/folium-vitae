/**
 * Integration tests for preferences as the app uses them across a session.
 *
 * Two tests were removed from this file: a "full CRUD cycle" whose every line
 * was commented out, and an error-message test that asserted
 * expect(true).toBe(true). Both passed while checking nothing, which is
 * worse than not having them — they made coverage look real.
 */

import {
  getUserPreferences,
  completeOnboarding,
  saveUserPreferences,
} from "@services/userPreferences";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage");

describe("User Onboarding Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should gate navigation until onboarding complete", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const prefs = await getUserPreferences();

    expect(prefs.hasCompletedOnboarding).toBe(false);
  });

  it("should allow navigation after onboarding", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await completeOnboarding("app-store");

    const callArg = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(callArg);

    expect(saved.hasCompletedOnboarding).toBe(true);
  });
});

describe("Settings Persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should persist preference changes across app restarts", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await saveUserPreferences({
      units: "imperial",
      hemisphere: "south",
    });

    const callArg = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const saved = JSON.parse(callArg);

    expect(saved.units).toBe("imperial");
    expect(saved.hemisphere).toBe("south");
  });

  it("should load preferences on app startup", async () => {
    const stored = {
      hasCompletedOnboarding: true,
      units: "imperial",
      hemisphere: "south",
      hasChildrenOrPets: true,
      showToxicityWarnings: true,
      notificationsEnabled: false,
    };

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));

    const prefs = await getUserPreferences();

    expect(prefs.units).toBe("imperial");
    expect(prefs.hemisphere).toBe("south");
    expect(prefs.notificationsEnabled).toBe(false);
  });
});

describe("Error Recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should gracefully handle storage failures", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("Storage unavailable"));

    const prefs = await getUserPreferences();

    expect(prefs.units).toBe("metric");
    expect(prefs.hemisphere).toBe("north");
  });
});
