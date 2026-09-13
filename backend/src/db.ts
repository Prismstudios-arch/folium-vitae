/**
 * PostgreSQL connection pool (Supabase).
 *
 * Everything that touches the database goes through here so there is one
 * place that owns pooling, SSL and query timing.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import logger from "./utils/logger";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. The API cannot start without a database — " +
      "it will not fall back to in-memory data."
  );
}

export const pool = new Pool({
  connectionString,
  // Supabase terminates TLS at the pooler with a certificate chain Node does
  // not ship a root for. The connection is still encrypted.
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  // An idle client failing is not fatal — the pool replaces it — but a burst
  // of these means the database is unhealthy and we want it in the logs.
  logger.error("Idle database client error:", error);
});

/**
 * Run a parameterised query. Always pass values as $1, $2… — never build SQL
 * by string concatenation.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params as never);
    const duration = Date.now() - start;

    if (duration > 500) {
      logger.warn(`Slow query (${duration}ms): ${text.slice(0, 120)}`);
    }

    return result;
  } catch (error) {
    logger.error(`Query failed: ${text.slice(0, 120)}`, error);
    throw error;
  }
}

/** First row, or null. Convenience for lookups by a unique key. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Run several statements atomically. Rolls back on any throw, so callers can
 * just throw to abort.
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Used by /health so the check reflects the database, not just the process. */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    await pool.query("SELECT 1");
    return { connected: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}
