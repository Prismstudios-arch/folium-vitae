/**
 * User repository — every function here hits Postgres.
 *
 * Inserting a user fires the create_user_prefs_trigger, which creates the
 * matching user_preferences and user_stats rows, so callers never create
 * those by hand.
 */

import { query, queryOne } from "../db";
import { ApiError } from "../middleware/errorHandler";
import { hashPassword } from "../services/auth";

export type Plan = "free" | "pro" | "premium";

/**
 * Daily identification allowance.
 *
 * SPEC §9 started the free tier at 7 a day, with the note to do the
 * arithmetic and tune. Each identification costs €0.05 at Kindwise's entry
 * rate: a free user using all 7 every day costs €10.50 a month, about twice
 * what a monthly subscriber nets after Apple's cut. At 3 a day the worst case
 * is €4.50, and 3 is still enough to try the app properly and save a few plants.
 */
export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 3,
  pro: 50,
  premium: Number.MAX_SAFE_INTEGER,
};

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string;
  plan: Plan;
  quota_used_today: number;
  last_quota_reset: Date;
  device_id: string | null;
  password_hash: string | null;
  created_at: Date;
}

const PUBLIC_COLUMNS = `
  id, email, display_name, plan, quota_used_today,
  last_quota_reset, device_id, created_at
`;

export async function findById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  // password_hash is selected explicitly here because login needs it; it is
  // deliberately absent from PUBLIC_COLUMNS so it cannot leak by accident.
  return queryOne<UserRow>(
    `SELECT ${PUBLIC_COLUMNS}, password_hash
       FROM users
      WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [email]
  );
}

export async function createWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserRow> {
  const existing = await findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with that email already exists");
  }

  const passwordHash = await hashPassword(password);

  const row = await queryOne<UserRow>(
    `INSERT INTO users (email, password_hash, display_name, plan)
     VALUES ($1, $2, $3, 'free')
     RETURNING ${PUBLIC_COLUMNS}`,
    [email.toLowerCase(), passwordHash, displayName]
  );

  if (!row) {
    throw ApiError.internal("Failed to create user");
  }

  return row;
}

/**
 * Find or create the user behind a device id.
 *
 * ON CONFLICT makes this idempotent, so two requests racing from the same
 * device cannot create two users.
 */
export async function findOrCreateByDevice(deviceId: string): Promise<UserRow> {
  const existing = await queryOne<UserRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE device_id = $1 AND deleted_at IS NULL`,
    [deviceId]
  );

  if (existing) {
    return existing;
  }

  const row = await queryOne<UserRow>(
    `INSERT INTO users (device_id, display_name, plan)
     VALUES ($1, $2, 'free')
     ON CONFLICT (device_id) WHERE device_id IS NOT NULL
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP
     RETURNING ${PUBLIC_COLUMNS}`,
    [deviceId, "Plant keeper"]
  );

  if (!row) {
    throw ApiError.internal("Failed to create anonymous user");
  }

  return row;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  plan: Plan;
  resetsAt: string;
}

/** Midnight tonight, which is when quota_used_today becomes stale. */
function nextReset(): string {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

export async function getQuota(userId: string): Promise<QuotaState> {
  const user = await findById(userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // The stored counter is only meaningful for today. Rather than run a reset
  // job, treat a stale last_quota_reset as zero and let the next consume
  // write the corrected value.
  const isStale = new Date(user.last_quota_reset).toDateString() !== new Date().toDateString();
  const used = isStale ? 0 : user.quota_used_today;
  const limit = PLAN_QUOTAS[user.plan];

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    plan: user.plan,
    resetsAt: nextReset(),
  };
}

/**
 * Atomically claim one identification credit.
 *
 * The check and the increment are a single statement on purpose: doing them
 * as a read-then-write would let concurrent requests each read "6 used" and
 * both proceed, handing out more scans than the plan allows.
 *
 * Returns null when the caller is already at their limit.
 */
export async function consumeQuota(userId: string): Promise<QuotaState | null> {
  const user = await findById(userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const limit = PLAN_QUOTAS[user.plan];

  const row = await queryOne<{ quota_used_today: number; plan: Plan }>(
    `UPDATE users
        SET quota_used_today = CASE
              WHEN last_quota_reset::date < CURRENT_DATE THEN 1
              ELSE quota_used_today + 1
            END,
            last_quota_reset = CASE
              WHEN last_quota_reset::date < CURRENT_DATE THEN CURRENT_TIMESTAMP
              ELSE last_quota_reset
            END
      WHERE id = $1
        AND deleted_at IS NULL
        AND (last_quota_reset::date < CURRENT_DATE OR quota_used_today < $2)
      RETURNING quota_used_today, plan`,
    [userId, limit]
  );

  if (!row) {
    return null; // at the cap
  }

  return {
    used: row.quota_used_today,
    limit,
    remaining: Math.max(0, limit - row.quota_used_today),
    plan: row.plan,
    resetsAt: nextReset(),
  };
}

/** Give a credit back when an identification fails after being claimed. */
export async function refundQuota(userId: string): Promise<void> {
  await query(
    `UPDATE users
        SET quota_used_today = GREATEST(0, quota_used_today - 1)
      WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
}

export async function setPlan(userId: string, plan: Plan): Promise<void> {
  await query(`UPDATE users SET plan = $2 WHERE id = $1 AND deleted_at IS NULL`, [
    userId,
    plan,
  ]);
}

/** Soft delete, so an export requested at the same time still resolves. */
export async function softDelete(userId: string): Promise<void> {
  await query(
    `UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
}

/**
 * Delete a user row outright. ON DELETE CASCADE removes everything keyed to
 * it: identifications, subscriptions, preferences, stats.
 *
 * Returns whether a row was removed.
 */
export async function hardDelete(userId: string): Promise<boolean> {
  const removed = await queryOne<{ id: string }>(
    `DELETE FROM users WHERE id = $1 RETURNING id`,
    [userId]
  );
  return removed !== null;
}

export function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    plan: row.plan,
    isAnonymous: row.email === null,
    createdAt: row.created_at,
  };
}
