/**
 * Migration runner.
 *
 * Applies every .sql file in migrations/ in filename order, inside a
 * transaction each, and records what ran in schema_migrations so re-running
 * is safe.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// The .env sits next to this script, not in whatever directory it was run
// from. Without the explicit path, `node backend/run-migrations.js` from the
// project root found no .env at all and then reported DATABASE_URL as unset —
// while claiming it had looked in backend/.env.
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set (looked in backend/.env)");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const dir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, file), "utf8");

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`  applied ${file}`);
        ran++;
      } catch (error) {
        await client.query("ROLLBACK");

        // 001 was applied by hand through the Supabase SQL editor before this
        // runner existed. Recognise that and record it rather than failing.
        if (error.code === "42P07" || error.code === "42710") {
          await client.query(
            "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
            [file]
          );
          console.log(`  recorded ${file} (objects already existed)`);
          continue;
        }

        console.error(`  FAILED  ${file}: ${error.message}`);
        throw error;
      }
    }

    await ensureRowLevelSecurity(client);

    console.log(ran > 0 ? `\nDone — ${ran} migration(s) applied.` : "\nDone — already up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Turn Row-Level Security on for any public table that doesn't have it.
 *
 * Supabase exposes public tables through its REST API, and a table without
 * RLS is open to anyone holding the project's public key (see
 * 004_lock_down_public_api.sql). The backend connects as the table owner, so
 * RLS never restricts it — which also means nothing would notice a new table
 * shipping without it. Checking on every run closes that gap.
 */
async function ensureRowLevelSecurity(client) {
  const { rows } = await client.query(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  `);

  for (const { relname } of rows) {
    await client.query(`ALTER TABLE public.${quoteIdentifier(relname)} ENABLE ROW LEVEL SECURITY`);
    console.log(`  enabled row-level security on ${relname}`);
  }
}

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

run().catch((error) => {
  console.error("Migration run failed:", error.message);
  process.exit(1);
});
