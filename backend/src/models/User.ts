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
 * Identification allowance, per seven-day window.
 *
 * Each identification costs €0.05 at Kindwise's entry rate, and an annual
 * subscription nets about $2.12 a month after Apple's 15% cut. The free tier
 * started at 7 a day and then 3 a day — €4.55 a month for someone who used
 * every one, which takes more than two annual subscribers to cover. Six per
 * seven days caps the worst case at €1.30.
 *
 * A window rather than a daily reset is also closer to how people use it: a
 * walk or a new shelf of plants is a burst, not one a day.
 *
 * There is deliberately no larger first-week allowance. One existed briefly,
 * on the argument that a new user wants to scan the whole windowsill, but it
 * meant the app opened by offering a number it would later take away.
 */
export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 6,
  pro: 50,
  premium: Number.MAX_SAFE_INTEGER,
};

/** Days an allowance window covers. */
export const QUOTA_WINDOW_DAYS = 7;

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string;
  plan: Plan;
  quota_used_in_window: number;
  quota_window_start: Date;
  device_id: string | null;
  password_hash: string | null;
  created_at: Date;
}

const PUBLIC_COLUMNS = `
  id, email, display_name, plan, quota_used_in_window,
  quota_window_start, device_id, created_at
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

const WINDOW_MS = QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** When the window that started at `start` runs out. */
function windowEnd(start: Date | string): Date {
  return new Date(new Date(start).getTime() + WINDOW_MS);
}

/** What this account is allowed in a window. */
export function limitFor(user: UserRow): number {
  return PLAN_QUOTAS[user.plan];
}

export async function getQuota(userId: string): Promise<QuotaState> {
  const user = await findById(userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // The stored counter only means anything inside its window. Rather than run
  // a reset job, treat a window that has run out as zero used and let the next
  // consume write the corrected value.
  const ends = windowEnd(user.quota_window_start);
  const expired = ends.getTime() <= Date.now();
  const used = expired ? 0 : user.quota_used_in_window;
  const limit = limitFor(user);

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    plan: user.plan,
    // A window that has run out has no reset date yet: the next one starts
    // when they next identify something. Say when that window would end.
    resetsAt: (expired ? new Date(Date.now() + WINDOW_MS) : ends).toISOString(),
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

  const limit = limitFor(user);

  const row = await queryOne<{
    quota_used_in_window: number;
    quota_window_start: Date;
    plan: Plan;
  }>(
    `UPDATE users
        SET quota_used_in_window = CASE
              WHEN quota_window_start <= CURRENT_TIMESTAMP - make_interval(days => $3::int) THEN 1
              ELSE quota_used_in_window + 1
            END,
            quota_window_start = CASE
              WHEN quota_window_start <= CURRENT_TIMESTAMP - make_interval(days => $3::int) THEN CURRENT_TIMESTAMP
              ELSE quota_window_start
            END
      WHERE id = $1
        AND deleted_at IS NULL
        AND (quota_window_start <= CURRENT_TIMESTAMP - make_interval(days => $3::int)
             OR quota_used_in_window < $2)
      RETURNING quota_used_in_window, quota_window_start, plan`,
    [userId, limit, QUOTA_WINDOW_DAYS]
  );

  if (!row) {
    return null; // at the cap
  }

  return {
    used: row.quota_used_in_window,
    limit,
    remaining: Math.max(0, limit - row.quota_used_in_window),
    plan: row.plan,
    resetsAt: windowEnd(row.quota_window_start).toISOString(),
  };
}

/** Give a credit back when an identification fails after being claimed. */
export async function refundQuota(userId: string): Promise<void> {
  await query(
    `UPDATE users
        SET quota_used_in_window = GREATEST(0, quota_used_in_window - 1)
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
