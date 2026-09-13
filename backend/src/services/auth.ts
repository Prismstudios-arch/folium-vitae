/**
 * Authentication: password hashing and JWT issuing/verification.
 *
 * The app is designed to work with no account at all (SPEC 9 — "No account,
 * no card"), so anonymous device-keyed users are a first-class path here, not
 * an afterthought bolted onto email/password.
 */

import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { VerdureError } from "../middleware/errorHandler";

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRY = process.env.JWT_EXPIRY || "1h";
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Refusing to start with an unsigned auth scheme.");
}

// Narrowed after the guard above so the rest of the file sees a string.
const SECRET: string = JWT_SECRET;

const BCRYPT_ROUNDS = 12;

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  sub: string; // user id
  plan: "free" | "pro" | "premium";
  anonymous: boolean;
  type: TokenType;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until the access token expires
  userId: string;
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

function sign(payload: Omit<TokenPayload, "type">, type: TokenType): string {
  const options: SignOptions = {
    expiresIn: (type === "access" ? ACCESS_EXPIRY : REFRESH_EXPIRY) as SignOptions["expiresIn"],
  };
  return jwt.sign({ ...payload, type }, SECRET, options);
}

export function issueTokens(payload: Omit<TokenPayload, "type">): TokenPair {
  const accessToken = sign(payload, "access");
  const refreshToken = sign(payload, "refresh");

  const decoded = jwt.decode(accessToken) as { exp?: number; iat?: number } | null;
  const expiresIn = decoded?.exp && decoded?.iat ? decoded.exp - decoded.iat : 3600;

  return { accessToken, refreshToken, expiresIn, userId: payload.sub };
}

/**
 * Verify a token and assert it is the kind the caller expects. Without the
 * type check a refresh token would be accepted as an access token, which
 * would hand a 7-day credential the privileges of a 1-hour one.
 */
export function verifyToken(token: string, expected: TokenType): TokenPayload {
  let decoded: TokenPayload;

  try {
    decoded = jwt.verify(token, SECRET) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw VerdureError.unauthorized("Token expired");
    }
    throw VerdureError.unauthorized("Invalid token");
  }

  if (decoded.type !== expected) {
    throw VerdureError.unauthorized(`Expected a ${expected} token`);
  }

  return decoded;
}
