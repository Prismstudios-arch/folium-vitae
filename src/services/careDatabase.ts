/**
 * Care knowledge lookup.
 *
 * Data lives in src/data/careGuides.json rather than in this file, so a wrong
 * record can be corrected — eventually by a remote delta — without shipping a
 * new build (SPEC §4).
 *
 * The lookup is deliberately forgiving about names. Providers return
 * "Monstera deliciosa Liebm.", cultivar names in quotes, and current
 * taxonomy that may differ from the name a record was filed under. An exact
 * string match finds almost none of those.
 */

import { CareGuide, LightLevel, WaterFrequency, SoilType, ToxicityLevel } from "@domain/plant";
import careData from "../data/careGuides.json";

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

/**
 * Reduce a botanical name to "genus species".
 *
 * Strips the naming authority ("Liebm."), cultivar names ("'Thai
 * Constellation'"), and infraspecific ranks ("var. borsigiana") — none of
 * which change the care advice, but all of which break an exact match.
 */
export function normaliseName(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/\s*'[^']*'/g, "")
    .replace(/\s*"[^"]*"/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*\b(var|subsp|ssp|cv|f)\b\.?\s.*$/, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .trim();
}

export function genusOf(name: string): string {
  return normaliseName(name).split(" ")[0] ?? "";
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

interface RawGuide {
  id: string;
  scientificName: string;
  synonyms: string[];
  commonNames: string[];
  family: string;
  genus: string;
  confidence: "species" | "genus";
  light: { min: string; max: string; notes?: string };
  water: { frequency: string; notes?: string; seasonalModifier?: string };
  soil: { type: string; notes?: string; drainage?: string };
  temperature: { minCelsius: number; maxCelsius: number; notes?: string };
  humidity: { minPercent: number; maxPercent: number; notes?: string };
  toxicity: { cats: string; dogs: string; humans: string; notes?: string };
  feeding?: string;
  repotting?: string;
  propagation?: string;
  commonProblems?: string[];
  growthHabit?: string;
  matureSize?: string;
  hardinessZone?: string;
  sourceRefs: string[];
  reviewedBy: string | null;
  lastReviewedAt: string | null;
}

function toCareGuide(raw: RawGuide): CareGuide {
  return {
    id: raw.id,
    scientificName: raw.scientificName,
    commonNames: raw.commonNames,
    taxonomy: `Family: ${raw.family}, Genus: ${raw.genus}`,
    light: {
      min: raw.light.min as LightLevel,
      max: raw.light.max as LightLevel,
      notes: raw.light.notes,
    },
    water: {
      frequency: raw.water.frequency as WaterFrequency,
      notes: raw.water.notes,
      seasonalModifier: raw.water.seasonalModifier,
    },
    soil: {
      type: raw.soil.type as SoilType,
      notes: raw.soil.notes,
      drainage: raw.soil.drainage,
    },
    temperature: raw.temperature,
    humidity: raw.humidity,
    toxicity: {
      cats: raw.toxicity.cats as ToxicityLevel,
      dogs: raw.toxicity.dogs as ToxicityLevel,
      humans: raw.toxicity.humans as ToxicityLevel,
      notes: raw.toxicity.notes,
    },
    feeding: raw.feeding,
    repotting: raw.repotting,
    propagation: raw.propagation,
    commonProblems: raw.commonProblems,
    growthHabit: raw.growthHabit,
    matureSize: raw.matureSize,
    hardinessZone: raw.hardinessZone,
    sourceRefs: raw.sourceRefs,
    reviewedBy: raw.reviewedBy ?? undefined,
    lastReviewedAt: raw.lastReviewedAt ? new Date(raw.lastReviewedAt) : undefined,
    confidence: raw.confidence,
  };
}

const speciesGuides: RawGuide[] = careData.guides as RawGuide[];
const genusGuides: RawGuide[] = careData.genusFallbacks as RawGuide[];

export const SEEDED_CARE_GUIDES: CareGuide[] = speciesGuides.map(toCareGuide);

/**
 * Every name a species record answers to — its accepted name plus its
 * synonyms. Sansevieria trifasciata was reclassified as Dracaena
 * trifasciata, so a provider on current taxonomy returns a name the record
 * is not filed under unless synonyms are indexed.
 */
const byName = new Map<string, RawGuide>();

for (const guide of speciesGuides) {
  byName.set(normaliseName(guide.scientificName), guide);
  for (const synonym of guide.synonyms) {
    byName.set(normaliseName(synonym), guide);
  }
}

const byGenus = new Map<string, RawGuide>();

for (const guide of genusGuides) {
  byGenus.set(guide.genus.toLowerCase(), guide);
  for (const synonym of guide.synonyms) {
    byGenus.set(synonym.toLowerCase(), guide);
  }
}

// A species record also serves as a genus answer when no explicit genus
// record exists — better to say "most Ficus want…" than nothing at all.
for (const guide of speciesGuides) {
  const key = guide.genus.toLowerCase();
  if (!byGenus.has(key)) {
    byGenus.set(key, guide);
  }
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export interface CareLookupResult {
  guide: CareGuide;
  /**
   * "species" — advice for this exact plant.
   * "genus"   — general advice for the genus. The UI must say so rather than
   *             implying the notes are species-specific (SPEC §4).
   */
  matchedAt: "species" | "genus";
  /** True when nobody has reviewed this record yet. Surfaced as a caveat. */
  unreviewed: boolean;
}

export function lookupCareGuide(scientificName: string): CareLookupResult | null {
  const normalised = normaliseName(scientificName);

  const exact = byName.get(normalised);
  if (exact) {
    return {
      guide: toCareGuide(exact),
      matchedAt: "species",
      unreviewed: !exact.reviewedBy,
    };
  }

  const genus = byGenus.get(genusOf(scientificName));
  if (genus) {
    return {
      guide: toCareGuide(genus),
      matchedAt: "genus",
      unreviewed: !genus.reviewedBy,
    };
  }

  // No record. Returning null is correct: the alternative is inventing care
  // advice for a plant we know nothing about, which is how people lose
  // expensive plants (SPEC §4).
  return null;
}

/** Backwards-compatible accessor. Prefer lookupCareGuide for the match level. */
export function getCareGuide(scientificName: string): CareGuide | null {
  return lookupCareGuide(scientificName)?.guide ?? null;
}

export function getCareGuideByGenus(genus: string): CareGuide | null {
  const guide = byGenus.get(genus.toLowerCase());
  return guide ? toCareGuide(guide) : null;
}

export function searchCareGuides(query: string): CareGuide[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];

  return speciesGuides
    .filter(
      (guide) =>
        guide.scientificName.toLowerCase().includes(needle) ||
        guide.commonNames.some((name) => name.toLowerCase().includes(needle)) ||
        guide.synonyms.some((name) => name.toLowerCase().includes(needle))
    )
    .map(toCareGuide);
}

/** How much of the database is filled in — used by the seeding script. */
export function careDatabaseStats() {
  return {
    species: speciesGuides.length,
    genera: genusGuides.length,
    reviewed: speciesGuides.filter((g) => g.reviewedBy).length,
    withSources: speciesGuides.filter((g) => g.sourceRefs.length > 0).length,
  };
}
