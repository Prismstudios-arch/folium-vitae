/**
 * Verdure Backend API
 * Phase 2: Complete production-ready server
 *
 * Features:
 * - User authentication (JWT + anonymous)
 * - Preferences synchronization
 * - Server-side quota tracking
 * - Push notification scheduling
 * - Plant collection management
 * - RevenueCat subscription integration
 * - Disease detection
 * - Expert support queue
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import logger from "./utils/logger";
import { errorHandler, asyncHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/auth";
import { preferencesRoutes } from "./routes/preferences";
import { quotaRoutes } from "./routes/quota";
import { plantsRoutes } from "./routes/plants";
import { notificationsRoutes } from "./routes/notifications";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================
// Security & Middleware
// ============================

// Helmet: Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow external APIs
}));

// CORS: Cross-origin resource sharing
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiting: Prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? "warn" : "info";
    logger[level as "warn" | "info"](
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });

  next();
});

// ============================
// Health & Status
// ============================

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "verdure-api",
    version: "2.0.0",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/api/status", (req: Request, res: Response) => {
  res.json({
    apiVersion: "v1",
    features: {
      authentication: true,
      preferences_sync: true,
      quota_management: true,
      push_notifications: true,
      revenueCat_subscriptions: !!process.env.REVENUECAT_API_KEY,
      kindwise_api: !!process.env.KINDWISE_API_KEY,
    },
    environment: NODE_ENV,
  });
});

// ============================
// API Routes
// ============================

app.use("/api/auth", authRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/quota", quotaRoutes);
app.use("/api/plants", plantsRoutes);
app.use("/api/notifications", notificationsRoutes);

// ============================
// Error Handling
// ============================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: "Not found",
      path: req.path,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler (MUST be last)
app.use(errorHandler);

// ============================
// Server Startup
// ============================

const server = app.listen(PORT, () => {
  logger.info(`Verdure API running on port ${PORT} (${NODE_ENV})`);
  logger.info(`Health check: http://localhost:${PORT}/health`);

  if (NODE_ENV === "development") {
    logger.info("Debug mode: ON");
    logger.info("API Status: http://localhost:${PORT}/api/status");
  }

  // Log startup checks
  const checks = {
    database: process.env.DATABASE_URL ? "✓" : "✗",
    kindwise_api: process.env.KINDWISE_API_KEY ? "✓" : "✗ (use mock)",
    revenuecat: process.env.REVENUECAT_API_KEY ? "✓" : "✗",
    jwt_secret: process.env.JWT_SECRET ? "✓" : "✗",
  };

  logger.info("Startup checks:", checks);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

export default app;
