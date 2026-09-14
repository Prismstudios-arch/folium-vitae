import { LightLevel, WaterFrequency, SoilType } from "@domain/plant";
import {
  describeLight,
  describeWaterShort,
  describeSoil,
  formatTemperatureRange,
} from "./careFormatting";

describe("describeLight", () => {
  it("names a single level once", () => {
    expect(
      describeLight({ min: LightLevel.BrightIndirect, max: LightLevel.BrightIndirect })
    ).toBe("Bright, indirect light");
  });

  it("describes a range", () => {
    expect(describeLight({ min: LightLevel.Low, max: LightLevel.Bright })).toBe(
      "Low light to bright light"
    );
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
});

describe("describeWaterShort and describeSoil", () => {
  it("covers every watering value", () => {
    for (const value of Object.values(WaterFrequency)) {
      expect(describeWaterShort(value)).not.toMatch(/[a-z][A-Z]/);
    }
    expect(describeWaterShort(WaterFrequency.KeepMoist)).toBe("Keep evenly moist");
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
