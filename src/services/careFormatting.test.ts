import { LightLevel, WaterFrequency, SoilType, ToxicityLevel } from "@domain/plant";
import {
  describeLight,
  describeLightPlace,
  describeWaterCue,
  describeWaterShort,
  describeSoil,
  describeToxicitySummary,
  formatTemperature,
  formatTemperatureRange,
  seasonalWatering,
} from "./careFormatting";

describe("describeLight", () => {
  it("names a single level once", () => {
    expect(describeLight({ min: LightLevel.BrightIndirect, max: LightLevel.BrightIndirect })).toBe(
      "Bright, indirect light"
    );
  });

  it("describes a range", () => {
    expect(describeLight({ min: LightLevel.Low, max: LightLevel.Bright })).toBe("Low light to bright light");
  });

  // The card previously printed these identifiers verbatim.
  it("never shows a raw identifier, even for a value it doesn't know", () => {
    const text = describeLight({
      min: "dappledShade" as LightLevel,
      max: "dappledShade" as LightLevel,
    });
    expect(text).toBe("Dappled shade");
    expect(text).not.toMatch(/[a-z][A-Z]/);
  });

  it("says where in a home that light is", () => {
    expect(describeLightPlace({ min: LightLevel.Medium, max: LightLevel.BrightIndirect })).toBe(
      "By a bright window, out of direct sun"
    );
  });
});

describe("describeWaterShort, describeWaterCue and describeSoil", () => {
  it("covers every watering value", () => {
    for (const value of Object.values(WaterFrequency)) {
      expect(describeWaterShort(value)).not.toMatch(/[a-z][A-Z]/);
      expect(describeWaterCue(value)).not.toMatch(/[a-z][A-Z]/);
    }
    expect(describeWaterShort(WaterFrequency.KeepMoist)).toBe("Keep evenly moist");
    expect(describeWaterCue(WaterFrequency.Rarely)).toBe("When the compost is completely dry");
  });

  it("covers every soil value", () => {
    for (const value of Object.values(SoilType)) {
      expect(describeSoil(value)).not.toMatch(/[a-z][A-Z]/);
    }
    expect(describeSoil(SoilType.CactusSucculent)).toBe("Cactus and succulent mix");
  });
});

describe("formatTemperatureRange", () => {
  it("shows Celsius for metric", () => {
    expect(formatTemperatureRange(18, 27, "metric")).toBe("18–27°C");
  });

  it("converts and rounds for imperial", () => {
    expect(formatTemperatureRange(18, 27, "imperial")).toBe("64–81°F");
  });

  // 21 * 1.8 + 32 is 69.80000000000001 in floating point, which is what
  // the card used to print.
  it("never prints floating-point noise", () => {
    expect(formatTemperatureRange(21, 30, "imperial")).toBe("70–86°F");
  });
});

describe("formatTemperature", () => {
  it("gives a range for plants that can't take frost", () => {
    expect(formatTemperature(15, 30, "metric")).toBe("15–30°C");
  });

  // "−15–27°C" reads as nonsense on a garden shrub.
  it("describes frost-hardy plants by how cold they can take", () => {
    expect(formatTemperature(-15, 27, "metric")).toBe("Hardy to −15°C");
    expect(formatTemperature(-15, 27, "imperial")).toBe("Hardy to 5°F");
  });
});

describe("seasonalWatering", () => {
  const water = {
    frequency: WaterFrequency.Moderate,
    growingSeason: "About weekly.",
    restingSeason: "Every 2–3 weeks.",
  };

  it("gives the growing-season advice in a northern July", () => {
    const result = seasonalWatering(water, "north", new Date(2026, 6, 15));

    expect(result.season).toBe("summer");
    expect(result.advice).toBe("About weekly.");
  });

  // The same date is midwinter for someone in the southern hemisphere.
  it("gives the resting advice in a southern July", () => {
    const result = seasonalWatering(water, "south", new Date(2026, 6, 15));

    expect(result.season).toBe("winter");
    expect(result.advice).toBe("Every 2–3 weeks.");
  });

  it("gives no advice rather than inventing some", () => {
    expect(seasonalWatering({ frequency: WaterFrequency.Low }, "north", new Date(2026, 0, 10)).advice).toBeNull();
  });
});

describe("describeToxicitySummary", () => {
  const none = ToxicityLevel.None;

  it("calls out anything severe", () => {
    expect(describeToxicitySummary({ cats: ToxicityLevel.Severe, dogs: none, humans: none })).toEqual({
      tone: "danger",
      label: "Highly toxic",
    });
  });

  it("warns about pets", () => {
    expect(describeToxicitySummary({ cats: ToxicityLevel.Mild, dogs: none, humans: none }).label).toBe("Toxic to pets");
  });

  it("warns about people when only people are affected", () => {
    expect(describeToxicitySummary({ cats: none, dogs: none, humans: ToxicityLevel.Mild }).label).toBe("Harmful if eaten");
  });

  // "Safe" would promise more than a care library can.
  it("says no known toxicity rather than calling a plant safe", () => {
    expect(describeToxicitySummary({ cats: none, dogs: none, humans: none })).toEqual({
      tone: "safe",
      label: "No known toxicity",
    });
  });
});
