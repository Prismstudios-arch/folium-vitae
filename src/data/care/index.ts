/**
 * The bundled care library, split by kind of plant so each file stays
 * reviewable. scripts/validate-care-data.js checks every file listed here.
 */

import sources from "./sources.json";
import aroids from "./aroids.json";
import foliageA from "./foliage-a.json";
import foliageB from "./foliage-b.json";
import succulents from "./succulents.json";
import palmsFerns from "./palms-ferns.json";
import flowering from "./flowering.json";
import edibles from "./edibles.json";
import garden from "./garden.json";

interface CareFile {
  guides: unknown[];
  genusFallbacks: unknown[];
}

const FILES: CareFile[] = [aroids, foliageA, foliageB, succulents, palmsFerns, flowering, edibles, garden];

export const CARE_SOURCES: Record<string, { title: string; short: string; url: string; covers: string }> = sources;

export const SPECIES_RECORDS: unknown[] = FILES.flatMap((file) => file.guides);
export const GENUS_RECORDS: unknown[] = FILES.flatMap((file) => file.genusFallbacks);
