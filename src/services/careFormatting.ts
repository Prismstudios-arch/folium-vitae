/**
 * Care guide values, in words a person would use.
 *
 * The care card printed the raw enum values — "brightIndirect",
 * "veryFrequent", "cactusSucculent" — straight onto the screen, and ignored
 * the units setting entirely. Its Fahrenheit conversion was unrounded
 * floating point, so 21°C read as 69.80000000000001°F.
 */

import {
  CareDifficulty,
  CarePlacement,
  LightLevel,
  LightRange,
  SoilType,
  Toxicity,
  ToxicityLevel,
  WaterFrequency,
  WaterSchedule,
} from "@domain/plant";
import { Hemisphere, Season, currentSeason } from "./wateringInsights";

export type Units = "metric" | "imperial";

const LIGHT: Record<LightLevel, string> = {
  [LightLevel.VeryLow]: "very low light",
  [LightLevel.Low]: "low light",
  [LightLevel.Medium]: "medium light",
  [LightLevel.Bright]: "bright light",
  [LightLevel.BrightIndirect]: "bright, indirect light",
  [LightLevel.BrightDirect]: "direct sun",
};

/** Where that light is found in a home — what people actually need to know. */
const LIGHT_PLACE: Record<LightLevel, string> = {
  [LightLevel.VeryLow]: "Copes with a dim corner",
  [LightLevel.Low]: "A few metres from a window",
  [LightLevel.Medium]: "Near a window, out of direct sun",
  [LightLevel.Bright]: "Close to a bright window",
  [LightLevel.BrightIndirect]: "By a bright window, out of direct sun",
  [LightLevel.BrightDirect]: "Several hours of direct sun",
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

/** When to water, as the thing to check rather than a number of days. */
const WATER_CUE: Record<WaterFrequency, string> = {
  [WaterFrequency.Rarely]: "When the compost is completely dry",
  [WaterFrequency.Low]: "When the top half is dry",
  [WaterFrequency.Moderate]: "When the top few centimetres are dry",
  [WaterFrequency.Frequent]: "As the surface starts to dry",
  [WaterFrequency.VeryFrequent]: "Often; don't let it dry",
  [WaterFrequency.KeepMoist]: "Never let it dry out",
  [WaterFrequency.KeepWet]: "Keep the roots wet",
};

const SOIL: Record<SoilType, string> = {
  [SoilType.Loamy]: "Loamy",
  [SoilType.Sandy]: "Sandy, fast-draining",
  [SoilType.Clay]: "Clay",
  [SoilType.PeatMoss]: "Acidic, moisture-holding",
  [SoilType.CactusSucculent]: "Cactus and succulent mix",
  [SoilType.Orchid]: "Bark-based, airy",
  [SoilType.General]: "General potting mix",
};

const DIFFICULTY: Record<CareDifficulty, string> = {
  easy: "Easy care",
  moderate: "Some care",
  demanding: "Needs attention",
};

const PLACEMENT: Record<CarePlacement, string> = {
  indoor: "Houseplant",
  outdoor: "Garden plant",
  both: "Indoors or out",
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

/** Where to put it, for the brightest light it wants. */
export function describeLightPlace(range: LightRange): string {
  return LIGHT_PLACE[range.max] ?? capitalise(humanise(range.max));
}

export function describeWaterShort(frequency: WaterFrequency): string {
  return WATER[frequency] ?? capitalise(humanise(frequency));
}

export function describeWaterCue(frequency: WaterFrequency): string {
  return WATER_CUE[frequency] ?? capitalise(humanise(frequency));
}

export function describeSoil(type: SoilType): string {
  return SOIL[type] ?? capitalise(humanise(type));
}

export function describeDifficulty(difficulty: CareDifficulty): string {
  return DIFFICULTY[difficulty] ?? capitalise(humanise(difficulty));
}

export function describePlacement(placement: CarePlacement): string {
  return PLACEMENT[placement] ?? capitalise(humanise(placement));
}

export function describeHumidity(minPercent: number): string {
  if (minPercent <= 30) return "Copes with dry air";
  if (minPercent < 50) return "Average room air is fine";
  if (minPercent < 60) return "Likes some humidity";
  return "Needs humid air";
}

function toFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

export function formatDegrees(celsius: number, units: Units): string {
  const value = units === "imperial" ? toFahrenheit(celsius) : Math.round(celsius);
  // A real minus sign: a hyphen next to a number reads as a dash.
  return `${value < 0 ? "−" : ""}${Math.abs(value)}°${units === "imperial" ? "F" : "C"}`;
}

export function formatTemperatureRange(minCelsius: number, maxCelsius: number, units: Units): string {
  if (units === "imperial") {
    return `${toFahrenheit(minCelsius)}–${toFahrenheit(maxCelsius)}°F`;
  }
  return `${Math.round(minCelsius)}–${Math.round(maxCelsius)}°C`;
}

/**
 * The temperature a plant needs, as people think about it. A plant that
 * survives frost is described by how cold it can take — "−15–27°C" reads as
 * nonsense on a garden shrub.
 */
export function formatTemperature(minCelsius: number, maxCelsius: number, units: Units): string {
  return minCelsius < 0
    ? `Hardy to ${formatDegrees(minCelsius, units)}`
    : formatTemperatureRange(minCelsius, maxCelsius, units);
}

export interface SeasonalWatering {
  season: Season;
  /** Whether the season is the growing half of the year. */
  growing: boolean;
  /** The record's advice for this half of the year, if it has any. */
  advice: string | null;
}

/**
 * Watering advice for the season it is where the person lives, rather than
 * the same sentence all year. Spring and summer use the growing-season line;
 * autumn and winter the resting one.
 */
export function seasonalWatering(
  water: WaterSchedule,
  hemisphere: Hemisphere,
  date: Date = new Date()
): SeasonalWatering {
  const season = currentSeason(hemisphere, date);
  const growing = season === "spring" || season === "summer";
  return {
    season,
    growing,
    advice: (growing ? water.growingSeason : water.restingSeason) ?? null,
  };
}

export type SafetyTone = "safe" | "caution" | "danger";

/** One line for the pet-and-child question, with how worried to be. */
export function describeToxicitySummary(toxicity: Toxicity): { tone: SafetyTone; label: string } {
  const levels = [toxicity.cats, toxicity.dogs, toxicity.humans];

  if (levels.includes(ToxicityLevel.Severe)) {
    return { tone: "danger", label: "Highly toxic" };
  }
  if (toxicity.cats !== ToxicityLevel.None || toxicity.dogs !== ToxicityLevel.None) {
    return { tone: "caution", label: "Toxic to pets" };
  }
  if (toxicity.humans !== ToxicityLevel.None) {
    return { tone: "caution", label: "Harmful if eaten" };
  }
  return { tone: "safe", label: "No known toxicity" };
}

export function describeToxicityLevel(level: ToxicityLevel): string {
  return capitalise(humanise(level));
}
