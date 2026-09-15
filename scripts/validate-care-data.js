/**
 * Validates the care library in src/data/care/.
 *
 *   node scripts/validate-care-data.js
 *
 * Care advice is the part of this product that can kill somebody's plant, so
 * the data is checked mechanically rather than trusted. Two rules matter
 * most: a record may not claim a reviewer without citing sources, and every
 * source it cites must exist — an unattributable credit is worse than none,
 * because SPEC §4 puts review and sourcing in the UI as trust signals.
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "src", "data", "care");

const LIGHT = ["veryLow", "low", "medium", "bright", "brightIndirect", "brightDirect"];
const WATER = ["rarely", "low", "moderate", "frequent", "veryFrequent", "keepMoist", "keepWet"];
const SOIL = ["loamy", "sandy", "clay", "peatMoss", "cactusSucculent", "orchid", "general"];
const TOXICITY = ["none", "mild", "moderate", "severe"];
const DIFFICULTY = ["easy", "moderate", "demanding"];
const PLACEMENT = ["indoor", "outdoor", "both"];

const errors = [];
const warnings = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

/** The same normalisation the app uses, so collisions are found as the app would hit them. */
function normaliseName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s*'[^']*'/g, "")
    .replace(/\s*"[^"]*"/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*\b(var|subsp|ssp|cv|f)\b\.?\s.*$/, "")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/(^|\s)x(\s|$)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .trim();
}

const text = (value) => typeof value === "string" && value.trim().length > 0;

function validateRecord(record, where, sources) {
  const id = record.id || "(no id)";
  const at = `${where} ${id}`;

  for (const field of ["id", "scientificName", "family", "genus", "confidence", "difficulty", "placement"]) {
    check(record[field], `${at}: missing ${field}`);
  }

  check(Array.isArray(record.synonyms), `${at}: synonyms must be an array (use [] for none)`);
  check(
    Array.isArray(record.commonNames) && record.commonNames.length > 0,
    `${at}: needs at least one common name — it is what the UI shows`
  );
  check(["species", "genus"].includes(record.confidence), `${at}: confidence must be "species" or "genus"`);
  check(DIFFICULTY.includes(record.difficulty), `${at}: difficulty "${record.difficulty}" is not one of ${DIFFICULTY}`);
  check(PLACEMENT.includes(record.placement), `${at}: placement "${record.placement}" is not one of ${PLACEMENT}`);

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
  if (LIGHT.includes(record.light?.min) && LIGHT.includes(record.light?.max)) {
    check(
      LIGHT.indexOf(record.light.min) <= LIGHT.indexOf(record.light.max),
      `${at}: light.min "${record.light.min}" is brighter than light.max "${record.light.max}"`
    );
  }

  check(WATER.includes(record.water?.frequency), `${at}: water.frequency "${record.water?.frequency}" is not a WaterFrequency`);
  // The seasonal lines are what the app shows as "right now".
  check(text(record.water?.growingSeason), `${at}: water.growingSeason is empty`);
  check(text(record.water?.restingSeason), `${at}: water.restingSeason is empty`);
  check(SOIL.includes(record.soil?.type), `${at}: soil.type "${record.soil?.type}" is not a SoilType`);

  for (const who of ["cats", "dogs", "humans"]) {
    check(TOXICITY.includes(record.toxicity?.[who]), `${at}: toxicity.${who} "${record.toxicity?.[who]}" is not a ToxicityLevel`);
  }

  // Toxicity drives a safety warning shown to people with pets and children,
  // so a non-none rating has to explain itself.
  const anyToxic = ["cats", "dogs", "humans"].some((who) => record.toxicity?.[who] && record.toxicity[who] !== "none");
  if (anyToxic) {
    check(text(record.toxicity?.notes), `${at}: toxic to something but toxicity.notes is empty`);
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

  check(Array.isArray(record.problems) && record.problems.length > 0, `${at}: needs at least one problem`);
  for (const [index, problem] of (record.problems ?? []).entries()) {
    for (const field of ["symptom", "cause", "fix"]) {
      check(text(problem?.[field]), `${at}: problems[${index}].${field} is empty`);
    }
  }

  check(Array.isArray(record.sourceRefs), `${at}: sourceRefs must be an array`);
  for (const ref of record.sourceRefs ?? []) {
    check(sources[ref], `${at}: cites unknown source "${ref}"`);
  }

  // The rule this file exists for.
  if (record.reviewedBy) {
    check(
      Array.isArray(record.sourceRefs) && record.sourceRefs.length > 0,
      `${at}: claims reviewedBy "${record.reviewedBy}" but cites no sources`
    );
    check(record.lastReviewedAt, `${at}: claims a reviewer but no lastReviewedAt`);
  } else {
    warnings.push(`${at}: not reviewed`);
  }
}

function main() {
  const sources = JSON.parse(fs.readFileSync(path.join(DIR, "sources.json"), "utf8"));

  for (const [id, source] of Object.entries(sources)) {
    for (const field of ["title", "short", "url", "covers"]) {
      check(text(source[field]), `source ${id}: missing ${field}`);
    }
  }

  const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".json") && name !== "sources.json");
  const index = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");

  const species = [];
  const genera = [];

  for (const name of files) {
    // A file the index doesn't import would validate here and never ship.
    check(index.includes(`./${name}`), `${name} is not imported by src/data/care/index.ts`);

    const data = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
    (data.guides ?? []).forEach((r) => {
      species.push(r);
      validateRecord(r, `${name} species`, sources);
    });
    (data.genusFallbacks ?? []).forEach((r) => {
      genera.push(r);
      validateRecord(r, `${name} genus`, sources);
      check(r.confidence === "genus", `${name} genus ${r.id}: confidence must be "genus"`);
    });
  }

  // Duplicate ids would make records unaddressable for a delta update.
  const ids = new Map();
  for (const record of [...species, ...genera]) {
    if (ids.has(record.id)) errors.push(`duplicate id "${record.id}"`);
    ids.set(record.id, true);
  }

  // Two records answering to the same name means one silently shadows the
  // other, and which wins depends on file order.
  const claimed = new Map();
  for (const record of species) {
    for (const name of [record.scientificName, ...(record.synonyms ?? [])]) {
      const key = normaliseName(name);
      if (claimed.has(key) && claimed.get(key) !== record.id) {
        errors.push(`"${name}" is claimed by both ${claimed.get(key)} and ${record.id}`);
      }
      claimed.set(key, record.id);
    }
  }

  const genusKeys = new Map();
  for (const record of genera) {
    for (const name of [record.genus, ...(record.synonyms ?? [])]) {
      const key = String(name).toLowerCase();
      if (genusKeys.has(key) && genusKeys.get(key) !== record.id) {
        errors.push(`genus "${name}" is claimed by both ${genusKeys.get(key)} and ${record.id}`);
      }
      genusKeys.set(key, record.id);
    }
  }

  // --- Report ------------------------------------------------------------
  const reviewed = species.filter((r) => r.reviewedBy).length;
  const sourced = species.filter((r) => r.sourceRefs?.length > 0).length;

  console.log(`\nCare library`);
  console.log(`  files             ${files.length}`);
  console.log(`  species records   ${species.length}`);
  console.log(`  genus fallbacks   ${genera.length}`);
  console.log(`  reviewed          ${reviewed} / ${species.length}`);
  console.log(`  toxicity sourced  ${sourced} / ${species.length}`);

  const TARGET = 450; // SPEC §4: ~300 houseplants + ~150 garden plants
  console.log(`  progress to ~${TARGET}  ${((species.length / TARGET) * 100).toFixed(1)}%`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} record(s) not yet reviewed by a horticulturist.`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }

  console.log("\nValid.\n");
}

main();
