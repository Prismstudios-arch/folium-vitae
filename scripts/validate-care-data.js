/**
 * Validates src/data/careGuides.json.
 *
 *   node scripts/validate-care-data.js
 *
 * Care advice is the part of this product that can kill somebody's plant, so
 * the data is checked mechanically rather than trusted. The rule that matters
 * most: a record may not claim a reviewer without citing sources. An
 * unattributable review credit is worse than no credit, because SPEC §4 puts
 * the review date in the UI as a trust signal.
 */

const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data", "careGuides.json");

const LIGHT = ["veryLow", "low", "medium", "bright", "brightIndirect", "brightDirect"];
const WATER = ["rarely", "low", "moderate", "frequent", "veryFrequent", "keepMoist", "keepWet"];
const SOIL = ["loamy", "sandy", "clay", "peatMoss", "cactusSucculent", "orchid", "general"];
const TOXICITY = ["none", "mild", "moderate", "severe"];

const errors = [];
const warnings = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function validateRecord(record, where) {
  const id = record.id || "(no id)";
  const at = `${where} ${id}`;

  for (const field of ["id", "scientificName", "family", "genus", "confidence"]) {
    check(record[field], `${at}: missing ${field}`);
  }

  check(Array.isArray(record.synonyms), `${at}: synonyms must be an array (use [] for none)`);
  check(
    Array.isArray(record.commonNames) && record.commonNames.length > 0,
    `${at}: needs at least one common name — it is what the UI shows`
  );
  check(
    ["species", "genus"].includes(record.confidence),
    `${at}: confidence must be "species" or "genus"`
  );

  // The genus field has to agree with the name, or genus fallback silently
  // files the record under the wrong key.
  if (record.scientificName && record.genus) {
    const derived = record.scientificName.split(/\s+/)[0].toLowerCase();
    check(
      derived === record.genus.toLowerCase(),
      `${at}: genus "${record.genus}" does not match scientificName "${record.scientificName}"`
    );
  }

  check(LIGHT.includes(record.light?.min), `${at}: light.min "${record.light?.min}" is not a LightLevel`);
  check(LIGHT.includes(record.light?.max), `${at}: light.max "${record.light?.max}" is not a LightLevel`);
  check(WATER.includes(record.water?.frequency), `${at}: water.frequency "${record.water?.frequency}" is not a WaterFrequency`);
  check(SOIL.includes(record.soil?.type), `${at}: soil.type "${record.soil?.type}" is not a SoilType`);

  for (const who of ["cats", "dogs", "humans"]) {
    check(
      TOXICITY.includes(record.toxicity?.[who]),
      `${at}: toxicity.${who} "${record.toxicity?.[who]}" is not a ToxicityLevel`
    );
  }

  // Toxicity drives a safety warning shown to people with pets and children,
  // so a non-none rating has to explain itself.
  const anyToxic = ["cats", "dogs", "humans"].some(
    (who) => record.toxicity?.[who] && record.toxicity[who] !== "none"
  );
  if (anyToxic) {
    check(record.toxicity?.notes, `${at}: toxic to something but toxicity.notes is empty`);
  }

  const { minCelsius, maxCelsius } = record.temperature ?? {};
  check(typeof minCelsius === "number" && typeof maxCelsius === "number", `${at}: temperature needs numeric min and max`);
  if (typeof minCelsius === "number" && typeof maxCelsius === "number") {
    check(minCelsius < maxCelsius, `${at}: temperature min (${minCelsius}) is not below max (${maxCelsius})`);
  }

  const { minPercent, maxPercent } = record.humidity ?? {};
  check(typeof minPercent === "number" && typeof maxPercent === "number", `${at}: humidity needs numeric min and max`);
  if (typeof minPercent === "number" && typeof maxPercent === "number") {
    check(minPercent < maxPercent, `${at}: humidity min (${minPercent}) is not below max (${maxPercent})`);
    check(minPercent >= 0 && maxPercent <= 100, `${at}: humidity outside 0-100`);
  }

  // The rule this file exists for.
  if (record.reviewedBy) {
    check(
      Array.isArray(record.sourceRefs) && record.sourceRefs.length > 0,
      `${at}: claims reviewedBy "${record.reviewedBy}" but cites no sources`
    );
    check(record.lastReviewedAt, `${at}: claims a reviewer but no lastReviewedAt`);
  }

  if (!record.reviewedBy) {
    warnings.push(`${at}: not reviewed`);
  }
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

  const species = data.guides ?? [];
  const genera = data.genusFallbacks ?? [];

  species.forEach((r) => validateRecord(r, "species"));
  genera.forEach((r) => validateRecord(r, "genus"));

  // Duplicate ids would make records unaddressable for a delta update.
  const ids = new Map();
  for (const record of [...species, ...genera]) {
    if (ids.has(record.id)) errors.push(`duplicate id "${record.id}"`);
    ids.set(record.id, true);
  }

  // Two records claiming the same synonym means one silently shadows the
  // other, and which one wins depends on file order.
  const claimed = new Map();
  for (const record of species) {
    for (const name of [record.scientificName, ...(record.synonyms ?? [])]) {
      const key = String(name).toLowerCase();
      if (claimed.has(key) && claimed.get(key) !== record.id) {
        errors.push(`"${name}" is claimed by both ${claimed.get(key)} and ${record.id}`);
      }
      claimed.set(key, record.id);
    }
  }

  // --- Report ------------------------------------------------------------
  const reviewed = species.filter((r) => r.reviewedBy).length;
  const sourced = species.filter((r) => r.sourceRefs?.length > 0).length;

  console.log(`\nCare database`);
  console.log(`  species records   ${species.length}`);
  console.log(`  genus fallbacks   ${genera.length}`);
  console.log(`  reviewed          ${reviewed} / ${species.length}`);
  console.log(`  with sources      ${sourced} / ${species.length}`);

  const TARGET = 450; // SPEC §4: ~300 houseplants + ~150 garden plants
  console.log(`  progress to ~${TARGET}  ${((species.length / TARGET) * 100).toFixed(1)}%`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} record(s) not yet reviewed:`);
    for (const warning of warnings.slice(0, 10)) console.log(`  - ${warning}`);
    if (warnings.length > 10) console.log(`  …and ${warnings.length - 10} more`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }

  console.log("\nValid.\n");
}

main();
