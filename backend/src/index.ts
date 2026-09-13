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

// Must be the first import. ES module imports are evaluated before any
// statement in this file, and db.ts / auth.ts read process.env at module
// load — so a dotenv.config() call further down would run too late and they
// would see an empty environment.
import "dotenv/config";

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { checkDatabaseHealth, closePool } from "./db";
import { authRoutes } from "./routes/auth";
import { preferencesRoutes } from "./routes/preferences";
import { quotaRoutes } from "./routes/quota";
import { plantsRoutes } from "./routes/plants";
import { notificationsRoutes } from "./routes/notifications";
import { identifyRoutes } from "./routes/identify";
import { isProviderConfigured } from "./services/identifyProvider";

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

app.get("/health", async (_req: Request, res: Response) => {
  // Reports the database, not just the process. A server that is up but
  // cannot reach Postgres is not healthy, and saying "ok" would hide the
  // only failure that matters.
  const database = await checkDatabaseHealth();

  res.status(database.connected ? 200 : 503).json({
    status: database.connected ? "ok" : "degraded",
    service: "folium-vitae-api",
    version: "2.0.0",
    environment: NODE_ENV,
    database,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/api/status", (_req: Request, res: Response) => {
  res.json({
    apiVersion: "v1",
    features: {
      // Reports what is actually wired, not what is planned. An honest
      // status endpoint is the first place to look when the app misbehaves.
      authentication: true,
      quota_management: true,
      identification: isProviderConfigured(),
      revenuecat_subscriptions: Boolean(process.env.REVENUECAT_API_KEY),
    },
    environment: NODE_ENV,
  });
});

// ============================
// API Routes
// ============================

app.use("/api/auth", authRoutes);
app.use("/api/identify", identifyRoutes);
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

// Bind 0.0.0.0 explicitly. Left to default, Node binds the IPv6 wildcard,
// which a container platform routing over IPv4 cannot always reach — the
// process looks healthy in its own logs while the edge returns 502.
const server = app.listen(Number(PORT), "0.0.0.0", async () => {
  logger.info(`Folium Vitae API listening on 0.0.0.0:${PORT} (${NODE_ENV})`);

  // Prove the database is reachable at boot rather than discovering it on
  // the first user request. A bad DATABASE_URL should be obvious in the
  // deploy log, not in a 500 an hour later.
  const database = await checkDatabaseHealth();

  if (database.connected) {
    logger.info(`Database connected (${database.latencyMs}ms)`);
  } else {
    logger.error(`DATABASE UNREACHABLE: ${database.error}`);
  }

  if (!isProviderConfigured()) {
    logger.warn(
      "KINDWISE_API_KEY is not set — /api/identify will return 503. " +
        "It will not serve fabricated results."
    );
  }
});

// Graceful shutdown: stop accepting connections, then drain the pool, so
// in-flight queries finish instead of being cut off mid-transaction.
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);

  server.close(async () => {
    try {
      await closePool();
    } catch (error) {
      logger.error("Error closing database pool:", error);
    }
    process.exit(0);
  });

  // Don't hang forever if a connection refuses to close.
  setTimeout(() => {
    logger.warn("Shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export default app;
