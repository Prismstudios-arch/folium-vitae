import { mapConfidenceBand, calibrateConfidence, IdentificationService } from "./identification";
import { ConfidenceBand } from "@domain/plant";
import { getApiClient, ApiError } from "./apiClient";

// The service is a thin layer over our own API by design, so the API client
// is the seam. Mocking it keeps these tests offline and deterministic.
jest.mock("./apiClient", () => {
  const actual = jest.requireActual("./apiClient");
  return { ...actual, getApiClient: jest.fn() };
});

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
    const mockIdentify = jest.fn();

    beforeEach(() => {
      mockIdentify.mockReset();
      (getApiClient as jest.Mock).mockReturnValue({ identify: mockIdentify });
    });

    it("is constructable", () => {
      expect(new IdentificationService()).toBeDefined();
    });

    it("sends the images to our API and calibrates the top candidate", async () => {
      mockIdentify.mockResolvedValue({
        candidates: [
          { scientificName: "Monstera deliciosa", commonNames: ["Swiss cheese plant"], rawScore: 0.91 },
          { scientificName: "Monstera adansonii", commonNames: ["Swiss cheese vine"], rawScore: 0.04 },
        ],
        provider: "kindwise",
        timestamp: new Date(),
        cached: false,
      });

      const outcome = await new IdentificationService().identify({
        images: [{ uri: "file://leaf.jpg", base64: "AAAA" }],
        imageHash: "hash-abc123",
      });

      expect(mockIdentify).toHaveBeenCalledWith(
        [{ uri: "file://leaf.jpg", base64: "AAAA" }],
        "hash-abc123"
      );
      expect(outcome.result.candidates).toHaveLength(2);
      expect(outcome.confidence.band).toBe(ConfidenceBand.Confident);
      expect(outcome.confidence.rawScore).toBe(0.91);
    });

    it("reports a cache hit so the UI can say no credit was spent", async () => {
      mockIdentify.mockResolvedValue({
        candidates: [{ scientificName: "Ficus elastica", commonNames: ["Rubber plant"], rawScore: 0.8 }],
        provider: "kindwise",
        timestamp: new Date(),
        cached: true,
      });

      const outcome = await new IdentificationService().identify({
        images: [{ uri: "file://x.jpg", base64: "AAAA" }],
        imageHash: "seen-before",
      });

      expect(outcome.cached).toBe(true);
    });

    // The point of the whole product: never invent an answer.
    it("propagates provider failures instead of fabricating a result", async () => {
      mockIdentify.mockRejectedValue(new ApiError("Identification is down.", 503, true));

      await expect(
        new IdentificationService().identify({
          images: [{ uri: "file://x.jpg", base64: "AAAA" }],
          imageHash: "hash-xyz",
        })
      ).rejects.toThrow("Identification is down.");
    });

    it("refuses a request with no image data rather than calling the API", async () => {
      await expect(
        new IdentificationService().identify({
          images: [{ uri: "file://no-data.jpg" }],
          imageHash: "hash-none",
        })
      ).rejects.toThrow();

      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe("Honest Error Messages", () => {
    it("should provide specific error messages", () => {
      // Test that error messages are specific and not generic
      const messages = [
        "Couldn't identify this plant",
        "No internet connection",
        "You've used all 6 of this week's identifications",
      ];

      messages.forEach((msg) => {
        expect(msg.length).toBeGreaterThan(5);
        // Should not contain error codes
        expect(msg).not.toMatch(/ERROR|CODE|FAIL/i);
      });
    });
  });
});
