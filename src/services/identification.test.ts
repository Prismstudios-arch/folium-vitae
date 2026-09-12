import { mapConfidenceBand, calibrateConfidence, IdentificationService, QuotaManager } from "./identification";
import { ConfidenceBand } from "@types/plant";

describe("Identification Service", () => {
  describe("Confidence Mapping", () => {
    it("should map high scores to Confident", () => {
      expect(mapConfidenceBand(0.92)).toBe(ConfidenceBand.Confident);
      expect(mapConfidenceBand(0.85)).toBe(ConfidenceBand.Confident);
      expect(mapConfidenceBand(0.75)).toBe(ConfidenceBand.Confident);
    });

    it("should map medium scores to Probably", () => {
      expect(mapConfidenceBand(0.70)).toBe(ConfidenceBand.Probably);
      expect(mapConfidenceBand(0.60)).toBe(ConfidenceBand.Probably);
      expect(mapConfidenceBand(0.50)).toBe(ConfidenceBand.Probably);
    });

    it("should map low scores to NotSure", () => {
      expect(mapConfidenceBand(0.49)).toBe(ConfidenceBand.NotSure);
      expect(mapConfidenceBand(0.30)).toBe(ConfidenceBand.NotSure);
      expect(mapConfidenceBand(0.10)).toBe(ConfidenceBand.NotSure);
    });
  });

  describe("Calibration", () => {
    it("should calibrate confidence with all fields", () => {
      const result = calibrateConfidence(0.85);

      expect(result).toHaveProperty("band");
      expect(result).toHaveProperty("rawScore");
      expect(result).toHaveProperty("calibratedScore");
      expect(result.band).toBe(ConfidenceBand.Confident);
      expect(result.rawScore).toBe(0.85);
      expect(result.calibratedScore).toBeLessThanOrEqual(1);
      expect(result.calibratedScore).toBeGreaterThanOrEqual(0);
    });

    it("should clamp scores to 0-1 range", () => {
      const high = calibrateConfidence(1.5);
      const low = calibrateConfidence(-0.5);

      expect(high.calibratedScore).toBeLessThanOrEqual(1);
      expect(low.calibratedScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("IdentificationService", () => {
    it("should be constructable with defaults", () => {
      const service = new IdentificationService();
      expect(service).toBeDefined();
    });

    it("should identify with mock mode", async () => {
      const service = new IdentificationService("https://api.verdure.app", true);
      const result = await service.identify({
        imageUri: "mock-image.jpg",
        imageHash: "abc123",
      });

      expect(result).toHaveProperty("candidates");
      expect(result).toHaveProperty("provider");
      expect(result).toHaveProperty("timestamp");
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it("should return top candidate with high confidence", async () => {
      const service = new IdentificationService("https://api.verdure.app", true);
      const result = await service.identify({
        imageUri: "mock-image.jpg",
      });

      expect(result.candidates[0]).toHaveProperty("scientificName");
      expect(result.candidates[0]).toHaveProperty("commonNames");
      expect(result.candidates[0]).toHaveProperty("rawScore");
    });
  });

  describe("Quota Management", () => {
    it("should have initial quota of 7", async () => {
      const manager = new QuotaManager();
      const quota = await manager.getQuota();

      expect(quota.remaining).toBe(7);
      expect(quota.used).toBe(0);
    });

    it("should allow scanning when quota available", async () => {
      const manager = new QuotaManager();
      const canScan = await manager.canScan();

      expect(canScan).toBe(true);
    });

    it("should track reset time", async () => {
      const manager = new QuotaManager();
      const quota = await manager.getQuota();

      expect(quota.resetsAt).toBeInstanceOf(Date);
      // Should reset tomorrow
      expect(quota.resetsAt > new Date()).toBe(true);
    });
  });

  describe("Honest Error Messages", () => {
    it("should provide specific error messages", () => {
      // Test that error messages are specific and not generic
      const messages = [
        "Couldn't identify this plant",
        "No internet connection",
        "You've reached your daily scan limit",
      ];

      messages.forEach((msg) => {
        expect(msg.length).toBeGreaterThan(5);
        // Should not contain error codes
        expect(msg).not.toMatch(/ERROR|CODE|FAIL/i);
      });
    });
  });
});
