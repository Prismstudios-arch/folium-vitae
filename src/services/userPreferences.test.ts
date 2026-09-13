import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getUserPreferences,
  saveUserPreferences,
  completeOnboarding,
  resetAllData,
  exportUserData,
  UserPreferences,
} from "./userPreferences";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage");

describe("UserPreferences Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserPreferences", () => {
    it("should return default preferences when storage is empty", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const prefs = await getUserPreferences();

      expect(prefs.hasCompletedOnboarding).toBe(false);
      expect(prefs.units).toBe("metric");
      expect(prefs.hemisphere).toBe("north");
      expect(prefs.showToxicityWarnings).toBe(true);
      expect(prefs.notificationsEnabled).toBe(true);
    });

    it("should return stored preferences when available", async () => {
      const stored = {
        hasCompletedOnboarding: true,
        units: "imperial",
        hemisphere: "south",
        hasChildrenOrPets: true,
        showToxicityWarnings: false,
        notificationsEnabled: false,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));

      const prefs = await getUserPreferences();

      expect(prefs.units).toBe("imperial");
      expect(prefs.hemisphere).toBe("south");
      expect(prefs.hasChildrenOrPets).toBe(true);
    });

    it("should handle storage errors gracefully", async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("Storage error"));

      const prefs = await getUserPreferences();

      expect(prefs.units).toBe("metric");
      expect(prefs.hemisphere).toBe("north");
    });
  });

  describe("saveUserPreferences", () => {
    it("should merge partial preferences with existing ones", async () => {
      const existing = {
        hasCompletedOnboarding: false,
        units: "metric",
        hemisphere: "north",
        hasChildrenOrPets: false,
        showToxicityWarnings: true,
        notificationsEnabled: true,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await saveUserPreferences({ units: "imperial" });

      const callArg = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const saved = JSON.parse(callArg);

      expect(saved.units).toBe("imperial");
      expect(saved.hemisphere).toBe("north");
    });

    it("should throw on storage error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error("Write error"));

      await expect(saveUserPreferences({ units: "imperial" })).rejects.toThrow("Write error");
    });
  });

  describe("completeOnboarding", () => {
    it("should set hasCompletedOnboarding to true", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await completeOnboarding("app-store-search");

      const callArg = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const saved = JSON.parse(callArg);

      expect(saved.hasCompletedOnboarding).toBe(true);
      expect(saved.referralSource).toBe("app-store-search");
    });

    it("should allow optional referral source", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await completeOnboarding();

      const callArg = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const saved = JSON.parse(callArg);

      expect(saved.hasCompletedOnboarding).toBe(true);
    });
  });

  describe("resetAllData", () => {
    it("should remove preferences from storage", async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await resetAllData();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("sorrel_user_preferences");
    });

    it("should handle removal errors", async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error("Removal failed"));

      await expect(resetAllData()).rejects.toThrow("Removal failed");
    });
  });

  describe("exportUserData", () => {
    it("should export preferences as JSON", async () => {
      const prefs: UserPreferences = {
        hasCompletedOnboarding: true,
        units: "metric",
        hemisphere: "north",
        hasChildrenOrPets: false,
        showToxicityWarnings: true,
        notificationsEnabled: true,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(prefs));

      const json = await exportUserData();
      const data = JSON.parse(json);

      expect(data.preferences).toEqual(prefs);
      expect(data.exportedAt).toBeDefined();
    });

    it("should include exportedAt timestamp", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const json = await exportUserData();
      const data = JSON.parse(json);

      expect(new Date(data.exportedAt)).toBeInstanceOf(Date);
    });

    it("should handle export errors", async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("Export failed"));

      await expect(exportUserData()).rejects.toThrow("Export failed");
    });
  });
});
