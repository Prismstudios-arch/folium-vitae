-- Cache identification responses by image hash.
--
-- Users re-scan the same plant constantly. Every repeat is a paid provider
-- call unless we remember the answer (SPEC 6 — perceptual-hash cache), and at
-- 7 free scans a day one enthusiastic free user can cost more than a
-- subscriber pays.
--
-- The result is stored whole as JSONB rather than flattened into columns so
-- the cached payload is byte-identical to a fresh one and the shape can
-- evolve with the provider without a migration.

CREATE TABLE IF NOT EXISTS identification_cache (
  image_hash   TEXT PRIMARY KEY,
  provider     VARCHAR(50) NOT NULL,
  result       JSONB       NOT NULL,
  hit_count    INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at  TIMESTAMPTZ
);

-- Supports the eviction sweep for entries nothing has touched in a while.
CREATE INDEX IF NOT EXISTS idx_identification_cache_created_at
  ON identification_cache (created_at);

-- 001 stored alternatives as TEXT[], which cannot hold the scored candidate
-- objects the result screen needs. JSONB can.
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS candidates JSONB;
