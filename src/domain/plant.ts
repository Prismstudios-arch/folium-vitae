/**
 * Plant domain types
 * Core business logic types (no UI framework dependencies)
 */

// MARK: - Taxonomy

export interface Taxonomy {
  /** Undefined when the provider does not return it — never guessed. */
  family?: string;
  genus: string;
  species?: string;
}

// MARK: - Species

export interface Species {
  id: string;
  scientificName: string;
  commonNames: string[];
  taxonomy: Taxonomy;
  rawScore: number; // Provider's raw confidence (0-1, may not be calibrated)
}

// MARK: - Identification Request & Result

/**
 * Plant parts a photo can show. Providers are materially more accurate when
 * given several organs of the same plant (SPEC 3.2), so capture coaches for
 * these rather than accepting a single anonymous frame.
 */
export enum PlantOrgan {
  Leaf = "leaf",
  Flower = "flower",
  Fruit = "fruit",
  Bark = "bark",
  Habit = "habit", // whole plant
}

export interface IdentificationImage {
  uri: string; // local file URI from capture or the photo library
  base64?: string; // populated only at the point of upload
  organ?: PlantOrgan;
}

export interface IdentificationRequest {
  images: IdentificationImage[];
  imageHash: string;
  priorSpecies?: Species[]; // carried across a multi-image refinement
}

export interface IdentificationResult {
  candidates: Species[];
  provider: string;
  timestamp: Date;
  /** Opaque provider token used to submit a user correction (SPEC 3.3). */
  feedbackToken?: string;
}

export enum ConfidenceBand {
  Confident = "confident",
  Probably = "probably",
  NotSure = "notSure",
}

export interface CalibratedConfidence {
  band: ConfidenceBand;
  rawScore: number;
  calibratedScore: number; // 0-1, properly calibrated
}

export interface PlantIdentified {
  id: string;
  species: Species;
  confidence: CalibratedConfidence;
  identificationDate: Date;
  photoHash: string;
}

// MARK: - Care Guide Types

export enum LightLevel {
  VeryLow = "veryLow",
  Low = "low",
  Medium = "medium",
  Bright = "bright",
  BrightIndirect = "brightIndirect",
  BrightDirect = "brightDirect",
}

export interface LightRange {
  min: LightLevel;
  max: LightLevel;
  notes?: string;
}

export enum WaterFrequency {
  Rarely = "rarely",
  Low = "low",
  Moderate = "moderate",
  Frequent = "frequent",
  VeryFrequent = "veryFrequent",
  KeepMoist = "keepMoist",
  KeepWet = "keepWet",
}

export interface WaterSchedule {
  frequency: WaterFrequency;
  notes?: string;
  seasonalModifier?: string;
}

export enum SoilType {
  Loamy = "loamy",
  Sandy = "sandy",
  Clay = "clay",
  PeatMoss = "peatMoss",
  CactusSucculent = "cactusSucculent",
  Orchid = "orchid",
  General = "general",
}

export interface SoilPreference {
  type: SoilType;
  notes?: string;
  drainage?: string;
}

export interface TemperatureRange {
  minCelsius: number;
  maxCelsius: number;
  notes?: string;
}

export interface HumidityRange {
  minPercent: number;
  maxPercent: number;
  notes?: string;
}

export enum ToxicityLevel {
  None = "none",
  Mild = "mild",
  Moderate = "moderate",
  Severe = "severe",
}

export interface Toxicity {
  cats: ToxicityLevel;
  dogs: ToxicityLevel;
  humans: ToxicityLevel;
  notes?: string;
}

export interface CareGuide {
  id: string;
  scientificName: string;
  commonNames: string[];
  taxonomy?: string;

  // Care details
  light: LightRange;
  water: WaterSchedule;
  soil: SoilPreference;
  temperature: TemperatureRange;
  humidity: HumidityRange;
  toxicity: Toxicity;

  // Additional info
  feeding?: string;
  repotting?: string;
  propagation?: string;
  commonProblems?: string[];
  growthHabit?: string;
  matureSize?: string;
  hardinessZone?: string;

  // Metadata
  sourceRefs?: string[];
  reviewedBy?: string;
  lastReviewedAt?: Date;
  confidence?: "species" | "genus";
}

// MARK: - Saved Plant (User's Collection)

export interface SavedPlant {
  id: string;
  nickname?: string;
  scientificName: string;
  commonNames: string[];
  location?: string;
  acquisitionDate?: Date;
  notes?: string;

  // Identification
  identificationDate: Date;
  providerData?: string; // JSON string of full provider response
  confidenceBand: ConfidenceBand;
  rawScore: number;
  calibratedScore: number;

  // Relationships
  photos: PlantPhoto[];
  waterLogs: WaterLog[];
  sortOrder: number;
  isFavorited: boolean;
  lastSyncedAt?: Date;
}

export interface PlantPhoto {
  id: string;
  dateTaken: Date;
  imagePath: string; // Relative to app documents
  imageHash: string;
  caption?: string;
}

export enum WaterAmount {
  Light = "light",
  Moderate = "moderate",
  Heavy = "heavy",
}

export interface WaterLog {
  id: string;
  date: Date;
  /** Optional: entries logged before this was recorded genuinely have none. */
  amount?: WaterAmount;
  notes?: string;
}

// Helper functions
export function getDisplayName(plant: SavedPlant | Species): string {
  if ("nickname" in plant && plant.nickname) {
    return plant.nickname;
  }
  return plant.commonNames[0] || plant.scientificName;
}

/**
 * Most recently taken photo, or undefined when the plant has none.
 * Photos are not guaranteed to arrive in date order, so compare rather
 * than trusting array position.
 */
export function getMostRecentPhoto(plant: SavedPlant): PlantPhoto | undefined {
  if (plant.photos.length === 0) {
    return undefined;
  }
  return plant.photos.reduce((latest, photo) =>
    photo.dateTaken.getTime() > latest.dateTaken.getTime() ? photo : latest
  );
}

export function getToxicityText(toxicity: Toxicity): string | null {
  const parts: string[] = [];
  if (toxicity.cats !== ToxicityLevel.None) {
    parts.push(`Toxic to cats (${toxicity.cats})`);
  }
  if (toxicity.dogs !== ToxicityLevel.None) {
    parts.push(`Toxic to dogs (${toxicity.dogs})`);
  }
  if (toxicity.humans !== ToxicityLevel.None) {
    parts.push(`Toxic to humans (${toxicity.humans})`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}
