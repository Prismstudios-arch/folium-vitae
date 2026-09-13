/**
 * Sorrel API.
 *
 * Deliberately small. It exists to do the things the app cannot do safely
 * for itself:
 *
 *  /api/auth      device-keyed and email sign-in, JWT issuing
 *  /api/identify  proxy to the vision provider, keeping the key off the
 *                 device and enforcing quota where a client cannot edit it
 *  /api/diagnose  health assessment, Premium only
 *  /api/quota     server-side scan allowance
 *  /api/webhooks  RevenueCat entitlements — the only thing that sets a plan
 *
 * There is no plants, preferences or notifications route. The app keeps the
 * collection in local SQLite and works offline, so those endpoints existed
 * only as stubs returning fabricated data, unauthenticated, and were removed
 * rather than left to be found. Cloud backup of a collection is a real gap
 * and wants building as its own slice, against a client that uses it.
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
import { quotaRoutes } from "./routes/quota";
import { identifyRoutes } from "./routes/identify";
import { webhookRoutes } from "./routes/webhooks";
import { diagnoseRoutes } from "./routes/diagnose";
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
  // Webhooks arrive from RevenueCat's own IPs and can burst — a renewal run
  // covers many users at once. Rate limiting them would drop purchase events
  // and leave people paying for a plan we never granted. They are
  // authenticated by a shared secret instead.
  skip: (req) => req.path.startsWith("/webhooks/"),
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
    service: "sorrel-api",
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
app.use("/api/webhooks", webhookRoutes);
app.use("/api/diagnose", diagnoseRoutes);
app.use("/api/quota", quotaRoutes);

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
  logger.info(`Sorrel API listening on 0.0.0.0:${PORT} (${NODE_ENV})`);

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
