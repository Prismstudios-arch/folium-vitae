/**
 * Authentication routes.
 *
 * Anonymous device sign-in is the primary path: the product promises a first
 * scan with no account (SPEC 9). Email accounts exist so a collection can
 * survive a new phone.
 */

import { Router, Request, Response } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { issueTokens, verifyPassword, verifyToken } from "../services/auth";
import * as Users from "../models/User";
import logger from "../utils/logger";

export const authRoutes = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function assertValidCredentials(email: unknown, password: unknown): asserts email is string {
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    throw ApiError.badRequest("Enter a valid email address");
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
}

/**
 * POST /api/auth/register
 */
authRoutes.post(
  "/register",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, displayName } = req.body ?? {};

    assertValidCredentials(email, password);

    if (typeof displayName !== "string" || displayName.trim().length === 0) {
      throw ApiError.badRequest("Enter a display name");
    }

    const user = await Users.createWithEmail(email, password, displayName.trim());
    const tokens = issueTokens({ sub: user.id, plan: user.plan, anonymous: false });

    logger.info(`Registered user ${user.id}`);

    res.status(201).json({ ...tokens, user: Users.toPublicUser(user) });
  })
);

/**
 * POST /api/auth/login
 */
authRoutes.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    assertValidCredentials(email, password);

    const user = await Users.findByEmail(email);

    // Same message whether the account is missing or the password is wrong —
    // distinguishing them lets an attacker enumerate registered emails.
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      throw ApiError.unauthorized("Email or password is incorrect");
    }

    const tokens = issueTokens({ sub: user.id, plan: user.plan, anonymous: false });

    res.json({ ...tokens, user: Users.toPublicUser(user) });
  })
);

/**
 * POST /api/auth/login-anonymous
 * Device-keyed. No account, no password, no PII.
 */
authRoutes.post(
  "/login-anonymous",
  asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.body ?? {};

    if (typeof deviceId !== "string" || deviceId.trim().length < 8) {
      throw ApiError.badRequest("A device id is required");
    }

    const user = await Users.findOrCreateByDevice(deviceId.trim());
    const tokens = issueTokens({ sub: user.id, plan: user.plan, anonymous: true });

    res.json({ ...tokens, user: Users.toPublicUser(user) });
  })
);

/**
 * POST /api/auth/refresh
 */
authRoutes.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};

    if (typeof refreshToken !== "string") {
      throw ApiError.badRequest("A refresh token is required");
    }

    const payload = verifyToken(refreshToken, "refresh");

    // Re-read the user so a plan change or deletion takes effect on refresh
    // rather than persisting until the old token expires.
    const user = await Users.findById(payload.sub);

    if (!user) {
      throw ApiError.unauthorized("Account no longer exists");
    }

    const tokens = issueTokens({
      sub: user.id,
      plan: user.plan,
      anonymous: user.email === null,
    });

    res.json({ ...tokens, user: Users.toPublicUser(user) });
  })
);

/**
 * GET /api/auth/me
 */
authRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await Users.findById(req.auth!.sub);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    res.json({ user: Users.toPublicUser(user) });
  })
);

/**
 * DELETE /api/auth/me
 *
 * Deletes the account outright — the users row and, by cascade, its
 * identification history, subscription record, preferences and stats. Not
 * the soft delete: a row with deleted_at set still holds everything, and the
 * privacy policy says Delete removes account data.
 *
 * Idempotent. If the first attempt deleted the row but the response was
 * lost, the retry must report success rather than "not found".
 *
 * This does not cancel an App Store subscription — only Apple can — and the
 * app says so before anyone confirms.
 */
authRoutes.delete(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.sub;
    const removed = await Users.hardDelete(userId);

    logger.info(removed ? `Deleted account ${userId}` : `Delete requested for absent account ${userId}`);

    res.status(204).end();
  })
);
