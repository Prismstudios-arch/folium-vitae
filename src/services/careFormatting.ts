/**
 * Care guide values, in words a person would use.
 *
 * The care card printed the raw enum values — "brightIndirect",
 * "veryFrequent", "cactusSucculent" — straight onto the screen, and ignored
 * the units setting entirely. Its Fahrenheit conversion was unrounded
 * floating point, so 21°C read as 69.80000000000001°F.
 */

import { LightLevel, LightRange, WaterFrequency, SoilType } from "@domain/plant";

export type Units = "metric" | "imperial";

const LIGHT: Record<LightLevel, string> = {
  [LightLevel.VeryLow]: "very low light",
  [LightLevel.Low]: "low light",
  [LightLevel.Medium]: "medium light",
  [LightLevel.Bright]: "bright light",
  [LightLevel.BrightIndirect]: "bright, indirect light",
  [LightLevel.BrightDirect]: "direct sun",
};

const WATER: Record<WaterFrequency, string> = {
  [WaterFrequency.Rarely]: "Rarely",
  [WaterFrequency.Low]: "Infrequently",
  [WaterFrequency.Moderate]: "Moderately",
  [WaterFrequency.Frequent]: "Frequently",
  [WaterFrequency.VeryFrequent]: "Very often",
  [WaterFrequency.KeepMoist]: "Keep evenly moist",
  [WaterFrequency.KeepWet]: "Keep wet",
};

const SOIL: Record<SoilType, string> = {
  [SoilType.Loamy]: "Loamy",
  [SoilType.Sandy]: "Sandy, fast-draining",
  [SoilType.Clay]: "Clay",
  [SoilType.PeatMoss]: "Peat-based",
  [SoilType.CactusSucculent]: "Cactus and succulent mix",
  [SoilType.Orchid]: "Orchid bark",
  [SoilType.General]: "General potting mix",
};

/**
 * Last resort for a value the tables don't know — the care data is JSON and
 * can hold values newer than this code. "someNewValue" becomes
 * "some new value" rather than leaking an identifier onto the screen.
 */
function humanise(value: unknown): string {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function describeLight(range: LightRange): string {
  const min = LIGHT[range.min] ?? humanise(range.min);
  const max = LIGHT[range.max] ?? humanise(range.max);
  return range.min === range.max ? capitalise(min) : `${capitalise(min)} to ${max}`;
}

export function describeWaterShort(frequency: WaterFrequency): string {
  return WATER[frequency] ?? capitalise(humanise(frequency));
}

export function describeSoil(type: SoilType): string {
  return SOIL[type] ?? capitalise(humanise(type));
}

function toFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

export function formatTemperatureRange(minCelsius: number, maxCelsius: number, units: Units): string {
  if (units === "imperial") {
    return `${toFahrenheit(minCelsius)}–${toFahrenheit(maxCelsius)}°F`;
  }
  return `${Math.round(minCelsius)}–${Math.round(maxCelsius)}°C`;
}
