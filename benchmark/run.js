/**
 * Provider benchmark — SPEC.md Phase 0.
 *
 * Runs a labelled photo set through each configured identification provider
 * and reports accuracy per category, so the provider decision is made on our
 * photos rather than the vendor's own benchmark.
 *
 *   node benchmark/run.js
 *
 * See benchmark/README.md for how to lay out the photos.
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });

const PHOTOS_DIR = path.join(__dirname, "photos");
const RESULTS_DIR = path.join(__dirname, "results");

/** Providers are rate limited; going flat out earns a 429 and skews latency. */
const DELAY_BETWEEN_CALLS_MS = 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Name matching
// ---------------------------------------------------------------------------

/** "Monstera deliciosa Liebm." -> "monstera deliciosa" */
function normaliseName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[×xX]\s/g, " ") // hybrid markers
    .replace(/\s*(var|subsp|ssp|f|cv)\.?\s.*$/, "") // infraspecific rank and beyond
    .replace(/\s*'[^']*'/g, "") // cultivar in quotes
    .replace(/\([^)]*\)/g, "") // author in parens
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2) // genus + species epithet only
    .join(" ")
    .trim();
}

function genusOf(name) {
  return normaliseName(name).split(" ")[0] ?? "";
}

/**
 * Compare a candidate against the expected answer.
 *
 * Genus-only is reported separately rather than counted as a miss: the care
 * database falls back to genus level (SPEC §4), so "some Philodendron" is a
 * genuinely useful answer, just not a precise one.
 */
function scoreMatch(expected, candidate) {
  const a = normaliseName(expected);
  const b = normaliseName(candidate);

  if (a && a === b) return "species";
  if (a && genusOf(a) === genusOf(b)) return "genus";
  return "miss";
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const providers = [];

if (process.env.KINDWISE_API_KEY) {
  providers.push({
    name: "kindwise",
    costPerCall: Number(process.env.KINDWISE_COST_PER_CALL || 0),
    async identify(base64) {
      const response = await fetch(
        (process.env.KINDWISE_BASE_URL || "https://plant.id/api/v3") +
          "/identification?details=common_names,taxonomy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": process.env.KINDWISE_API_KEY,
          },
          body: JSON.stringify({ images: [base64], similar_images: false }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = await response.json();
      const suggestions = body?.result?.classification?.suggestions ?? [];

      return suggestions.slice(0, 5).map((s) => ({
        name: s.name,
        score: s.probability,
      }));
    },
  });
}

if (process.env.PLANTNET_API_KEY) {
  providers.push({
    name: "plantnet",
    costPerCall: Number(process.env.PLANTNET_COST_PER_CALL || 0),
    async identify(base64, filename) {
      const form = new FormData();
      form.append(
        "images",
        new Blob([Buffer.from(base64, "base64")], { type: "image/jpeg" }),
        filename
      );

      const response = await fetch(
        `https://my-api.plantnet.org/v2/identify/all?api-key=${process.env.PLANTNET_API_KEY}`,
        { method: "POST", body: form }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = await response.json();

      return (body?.results ?? []).slice(0, 5).map((r) => ({
        name: r.species?.scientificNameWithoutAuthor,
        score: r.score,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Photo set
// ---------------------------------------------------------------------------

function loadPhotos() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    return [];
  }

  const photos = [];

  for (const category of fs.readdirSync(PHOTOS_DIR)) {
    const categoryDir = path.join(PHOTOS_DIR, category);
    if (!fs.statSync(categoryDir).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryDir)) {
      if (!/\.(jpe?g|png)$/i.test(file)) continue;

      // "monstera-deliciosa__2.jpg" -> "monstera deliciosa"
      const expected = path
        .basename(file)
        .replace(/\.(jpe?g|png)$/i, "")
        .split("__")[0]
        .replace(/-/g, " ");

      photos.push({ category, file, expected, fullPath: path.join(categoryDir, file) });
    }
  }

  return photos;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function summarise(rows) {
  const byKey = new Map();

  for (const row of rows) {
    for (const key of [`${row.provider} · ALL`, `${row.provider} · ${row.category}`]) {
      if (!byKey.has(key)) {
        byKey.set(key, { n: 0, top1: 0, top3: 0, genus: 0, errors: 0, scoreSum: 0, latencySum: 0 });
      }

      const bucket = byKey.get(key);
      bucket.n++;

      if (row.error) {
        bucket.errors++;
        continue;
      }

      if (row.top1Match === "species") bucket.top1++;
      if (row.top1Match === "genus") bucket.genus++;
      if (row.top3Match === "species") bucket.top3++;

      bucket.scoreSum += row.top1Score || 0;
      bucket.latencySum += row.latencyMs || 0;
    }
  }

  return byKey;
}

function percent(part, whole) {
  return whole === 0 ? "  n/a" : `${((part / whole) * 100).toFixed(0).padStart(4)}%`;
}

async function main() {
  if (providers.length === 0) {
    console.error(
      "No provider keys found.\n" +
        "Set KINDWISE_API_KEY and/or PLANTNET_API_KEY in backend/.env, then re-run."
    );
    process.exit(1);
  }

  const photos = loadPhotos();

  if (photos.length === 0) {
    console.error(
      `No photos found in ${PHOTOS_DIR}\n` +
        "See benchmark/README.md for the folder layout."
    );
    process.exit(1);
  }

  console.log(`Providers: ${providers.map((p) => p.name).join(", ")}`);
  console.log(`Photos:    ${photos.length}`);
  console.log(
    `Estimated: ${photos.length * providers.length} calls, ` +
      `~${Math.ceil((photos.length * providers.length * DELAY_BETWEEN_CALLS_MS) / 60000)} min\n`
  );

  const rows = [];

  for (const provider of providers) {
    for (const [index, photo] of photos.entries()) {
      const base64 = fs.readFileSync(photo.fullPath).toString("base64");
      const started = Date.now();

      let row = {
        provider: provider.name,
        category: photo.category,
        file: photo.file,
        expected: photo.expected,
      };

      try {
        const candidates = await provider.identify(base64, photo.file);
        const latencyMs = Date.now() - started;

        const top1 = candidates[0];
        const top3 = candidates.slice(0, 3);

        row = {
          ...row,
          got: top1?.name ?? "",
          top1Score: top1?.score ?? 0,
          top1Match: top1 ? scoreMatch(photo.expected, top1.name) : "miss",
          top3Match: top3.some((c) => scoreMatch(photo.expected, c.name) === "species")
            ? "species"
            : "miss",
          latencyMs,
          error: "",
        };

        const mark = row.top1Match === "species" ? "✓" : row.top1Match === "genus" ? "~" : "✗";
        process.stdout.write(
          `  ${mark} [${provider.name}] ${photo.category}/${photo.file} → ${row.got || "(none)"}\n`
        );
      } catch (error) {
        row = { ...row, got: "", top1Score: 0, top1Match: "miss", top3Match: "miss", latencyMs: 0, error: error.message };
        process.stdout.write(`  ! [${provider.name}] ${photo.file} → ${error.message}\n`);
      }

      rows.push(row);

      if (index < photos.length - 1) {
        await sleep(DELAY_BETWEEN_CALLS_MS);
      }
    }
  }

  // --- CSV ---------------------------------------------------------------
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = path.join(RESULTS_DIR, `${stamp}.csv`);

  const header = "provider,category,file,expected,got,top1_score,top1_match,top3_match,latency_ms,error";
  const csv = [header]
    .concat(
      rows.map((r) =>
        [
          r.provider,
          r.category,
          r.file,
          `"${r.expected}"`,
          `"${r.got}"`,
          (r.top1Score ?? 0).toFixed(4),
          r.top1Match,
          r.top3Match,
          r.latencyMs,
          `"${r.error}"`,
        ].join(",")
      )
    )
    .join("\n");

  fs.writeFileSync(csvPath, csv);

  // --- Summary -----------------------------------------------------------
  console.log("\n" + "=".repeat(78));
  console.log("RESULTS".padEnd(30) + "   n   top-1   top-3   genus   meanScore   meanMs");
  console.log("=".repeat(78));

  const summary = summarise(rows);
  const keys = [...summary.keys()].sort();

  for (const key of keys) {
    const b = summary.get(key);
    const ok = b.n - b.errors;

    console.log(
      key.padEnd(30) +
        String(b.n).padStart(4) +
        percent(b.top1, ok).padStart(8) +
        percent(b.top3, ok).padStart(8) +
        percent(b.genus, ok).padStart(8) +
        (ok ? (b.scoreSum / ok).toFixed(2) : "n/a").padStart(12) +
        (ok ? Math.round(b.latencySum / ok) : "n/a").toString().padStart(9) +
        (b.errors ? `   (${b.errors} failed)` : "")
    );

    if (key.endsWith("· ALL")) console.log("-".repeat(78));
  }

  // --- Cost --------------------------------------------------------------
  console.log("\nCost projection (set *_COST_PER_CALL in backend/.env for real numbers):");
  for (const provider of providers) {
    const calls = rows.filter((r) => r.provider === provider.name).length;
    const perScan = provider.costPerCall;

    console.log(
      `  ${provider.name.padEnd(12)} ${calls} calls this run` +
        (perScan > 0
          ? ` · $${(calls * perScan).toFixed(2)}` +
            ` · a free user at 7 scans/day costs $${(perScan * 7 * 30).toFixed(2)}/month`
          : " · no cost configured")
    );
  }

  console.log(`\nCSV: ${csvPath}`);
  console.log(
    "\nThe decision: is top-1 on grass and seedling high enough to claim you\n" +
      "beat PictureThis? If not, the positioning needs to change before more\n" +
      "is built on it (SPEC §11).\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
