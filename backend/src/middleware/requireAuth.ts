/**
 * Bearer-token authentication middleware.
 *
 * Attaches the verified caller to req.auth. Routes must never read a user id
 * from the request body or params for authorisation decisions — only from
 * here, which is the only source a client cannot forge.
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../services/auth";
import { VerdureError } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(VerdureError.unauthorized("Missing bearer token"));
  }

  try {
    req.auth = verifyToken(header.slice("Bearer ".length).trim(), "access");
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Assert the authenticated caller owns the :userId in the path.
 *
 * Without this, any valid token could read or mutate any other user's row
 * simply by changing the id in the URL.
 */
export function requireSelf(req: Request, _res: Response, next: NextFunction): void {
  const target = req.params.userId;

  if (!req.auth) {
    return next(VerdureError.unauthorized("Not authenticated"));
  }

  if (target && target !== req.auth.sub) {
    return next(VerdureError.forbidden("You can only access your own data"));
  }

  next();
}
