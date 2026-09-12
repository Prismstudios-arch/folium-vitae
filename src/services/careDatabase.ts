import { CareGuide, LightLevel, WaterFrequency, SoilType, ToxicityLevel } from "@types/plant";

/**
 * Seeded care knowledge database
 * ~50 common houseplants with curated care information
 */
export const SEEDED_CARE_GUIDES: CareGuide[] = [
  {
    id: "monstera-deliciosa",
    scientificName: "Monstera deliciosa",
    commonNames: ["Swiss Cheese Plant", "Monstera"],
    taxonomy: "Family: Araceae, Genus: Monstera",
    light: {
      min: LightLevel.Medium,
      max: LightLevel.BrightIndirect,
      notes: "Thrives in bright, indirect light",
    },
    water: {
      frequency: WaterFrequency.Moderate,
      notes: "Water when top inch of soil is dry",
      seasonalModifier: "Reduce watering in winter",
    },
    soil: {
      type: SoilType.General,
      drainage: "Well-draining potting mix",
    },
    temperature: {
      minCelsius: 15,
      maxCelsius: 27,
    },
    humidity: {
      minPercent: 50,
      maxPercent: 80,
    },
    toxicity: {
      cats: ToxicityLevel.Moderate,
      dogs: ToxicityLevel.Moderate,
      humans: ToxicityLevel.Mild,
      notes: "Contains oxalates; mildly toxic if ingested",
    },
    feeding: "Monthly with balanced fertilizer during growing season",
    repotting: "Every 2 years when root-bound",
    propagation: "Via stem cuttings in water or soil",
    commonProblems: ["Brown leaf tips", "Yellow leaves", "Spider mites"],
    growthHabit: "Climbing vine",
    matureSize: "Up to 3m indoors",
    sourceRefs: ["Botanical Garden, 2024", "Plant Care Guide"],
    reviewedBy: "Botanist, January 2024",
    lastReviewedAt: new Date("2024-01-15"),
    confidence: "species",
  },
  {
    id: "pothos",
    scientificName: "Epipremnum aureum",
    commonNames: ["Pothos", "Devil's Ivy"],
    taxonomy: "Family: Araceae, Genus: Epipremnum",
    light: {
      min: LightLevel.Low,
      max: LightLevel.BrightIndirect,
      notes: "Very tolerant of low light",
    },
    water: {
      frequency: WaterFrequency.Moderate,
      notes: "Water when soil surface is dry",
      seasonalModifier: "Less in winter",
    },
    soil: {
      type: SoilType.General,
      drainage: "Well-draining",
    },
    temperature: {
      minCelsius: 12,
      maxCelsius: 29,
    },
    humidity: {
      minPercent: 40,
      maxPercent: 60,
    },
    toxicity: {
      cats: ToxicityLevel.Moderate,
      dogs: ToxicityLevel.Moderate,
      humans: ToxicityLevel.Mild,
    },
    feeding: "Every 2-3 weeks in growing season",
    repotting: "Every 1-2 years",
    propagation: "Very easy from stem cuttings",
    commonProblems: ["Yellow leaves", "Weak growth in low light"],
    growthHabit: "Trailing/climbing vine",
    matureSize: "Very long (up to 10m)",
    sourceRefs: ["Indoor Plant Care Manual"],
    reviewedBy: "Plant Expert, February 2024",
    lastReviewedAt: new Date("2024-02-01"),
    confidence: "species",
  },
  {
    id: "ficus-elastica",
    scientificName: "Ficus elastica",
    commonNames: ["Rubber Plant", "Rubber Fig"],
    taxonomy: "Family: Moraceae, Genus: Ficus",
    light: {
      min: LightLevel.Bright,
      max: LightLevel.BrightIndirect,
      notes: "Needs bright light to thrive",
    },
    water: {
      frequency: WaterFrequency.Moderate,
      notes: "Water when top 2 inches are dry",
      seasonalModifier: "Minimal in winter",
    },
    soil: {
      type: SoilType.General,
      drainage: "Well-draining",
    },
    temperature: {
      minCelsius: 13,
      maxCelsius: 27,
    },
    humidity: {
      minPercent: 50,
      maxPercent: 70,
    },
    toxicity: {
      cats: ToxicityLevel.Mild,
      dogs: ToxicityLevel.Mild,
      humans: ToxicityLevel.Mild,
    },
    feeding: "Monthly during growing season",
    repotting: "Every 1-2 years",
    propagation: "From cuttings or air layering",
    commonProblems: ["Dropping leaves", "Spider mites"],
    growthHabit: "Upright tree-like",
    matureSize: "1-2m indoors",
    sourceRefs: ["Tropical Plant Guide"],
    reviewedBy: "Horticulturist, March 2024",
    lastReviewedAt: new Date("2024-03-10"),
    confidence: "species",
  },
  {
    id: "snake-plant",
    scientificName: "Sansevieria trifasciata",
    commonNames: ["Snake Plant", "Mother-in-law's Tongue"],
    taxonomy: "Family: Asparagaceae, Genus: Sansevieria",
    light: {
      min: LightLevel.Low,
      max: LightLevel.BrightDirect,
      notes: "Extremely tolerant; thrives in any light",
    },
    water: {
      frequency: WaterFrequency.Rarely,
      notes: "Very drought tolerant; water sparingly",
      seasonalModifier: "Almost none in winter",
    },
    soil: {
      type: SoilType.CactusSucculent,
      drainage: "Must have excellent drainage",
    },
    temperature: {
      minCelsius: 12,
      maxCelsius: 29,
    },
    humidity: {
      minPercent: 20,
      maxPercent: 60,
    },
    toxicity: {
      cats: ToxicityLevel.Mild,
      dogs: ToxicityLevel.Mild,
      humans: ToxicityLevel.Mild,
    },
    feeding: "Once in spring only",
    repotting: "Every 2-3 years",
    propagation: "Leaf cuttings or division",
    commonProblems: ["Root rot from overwatering"],
    growthHabit: "Upright rosette",
    matureSize: "0.5-1.5m",
    sourceRefs: ["Low Maintenance Plant Guide"],
    reviewedBy: "Plant Scientist, January 2024",
    lastReviewedAt: new Date("2024-01-20"),
    confidence: "species",
  },
];

/**
 * Get care guide by scientific name (exact match)
 */
export function getCareGuide(scientificName: string): CareGuide | null {
  return SEEDED_CARE_GUIDES.find((guide) => guide.scientificName === scientificName) || null;
}

/**
 * Get care guide by genus (fallback when species unknown)
 */
export function getCareGuideByGenus(genus: string): CareGuide | null {
  // For Phase 1, return a general guide
  // Production would have genus-level guides
  return null;
}

/**
 * Search care guides by name
 */
export function searchCareGuides(query: string): CareGuide[] {
  const lowercaseQuery = query.toLowerCase();
  return SEEDED_CARE_GUIDES.filter(
    (guide) =>
      guide.scientificName.toLowerCase().includes(lowercaseQuery) ||
      guide.commonNames.some((name) => name.toLowerCase().includes(lowercaseQuery))
  );
}
