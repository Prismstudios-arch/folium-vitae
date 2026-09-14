/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent error responses
 */

import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/** Any error that carries an HTTP status — including ones thrown by libraries. */
export interface HttpError extends Error {
  statusCode?: number;
  details?: Record<string, any>;
}

export class ApiError extends Error implements HttpError {
  statusCode: number;
  details?: Record<string, any>;

  constructor(statusCode: number, message: string, details?: Record<string, any>) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string, details?: Record<string, any>) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message: string = "Unauthorized") {
    return new ApiError(401, message);
  }

  /** code: machine-readable reason the app can act on, e.g. PREMIUM_REQUIRED. */
  static forbidden(message: string = "Forbidden", code?: string) {
    return new ApiError(403, message, code ? { code } : undefined);
  }

  static notFound(message: string = "Not found") {
    return new ApiError(404, message);
  }

  static conflict(message: string, details?: Record<string, any>) {
    return new ApiError(409, message, details);
  }

  /** code: machine-readable reason the app can act on, e.g. DAILY_LIMIT. */
  static tooManyRequests(message: string = "Too many requests", code?: string) {
    return new ApiError(429, message, code ? { code } : undefined);
  }

  /**
   * The request was well-formed but we could not act on it — a photo with no
   * plant in it, for example. Distinct from 400: the client did nothing wrong.
   */
  static unprocessable(message: string, details?: Record<string, any>) {
    return new ApiError(422, message, details);
  }

  static internal(message: string = "Internal server error", details?: Record<string, any>) {
    return new ApiError(500, message, details);
  }

  /** An upstream dependency is unavailable. Retryable; not the caller's fault. */
  static serviceUnavailable(message: string = "Service temporarily unavailable") {
    return new ApiError(503, message);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const timestamp = new Date().toISOString();
  const path = req.path;
  const method = req.method;

  // Default to 500 if no status code
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Log the error
  const logData = {
    timestamp,
    method,
    path,
    statusCode,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    ...(err.details && { details: err.details }),
  };

  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${message}`, logData);
  } else {
    logger.warn(`[${statusCode}] ${message}`, logData);
  }

  // Sanitize error message for production
  let clientMessage = message;
  if (process.env.NODE_ENV === "production" && statusCode >= 500) {
    clientMessage = "Internal server error";
  }

  // Send response
  res.status(statusCode).json({
    error: {
      message: clientMessage,
      statusCode,
      timestamp,
      // Sent in every environment, unlike details. Without it the app can't
      // tell a spent daily allowance from a transient rate limit — both are
      // 429 — and offered "Try again" for a limit that lasts until midnight.
      ...(typeof err.details?.code === "string" && { code: err.details.code }),
      ...(process.env.NODE_ENV === "development" && {
        details: err.details,
        stack: err.stack?.split("\n").slice(0, 5),
      }),
    },
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
