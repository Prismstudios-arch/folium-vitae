/**
 * Verdure Backend API
 * Phase 2: Preferences sync, quota tracking, notifications
 *
 * Features:
 * - User preferences synchronization
 * - Server-side quota tracking (lift Phase 1's 7/day limit)
 * - Push notification scheduling
 * - Plant collection sync
 * - Disease detection feedback
 */

import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import logger from "./utils/logger";
import { authRoutes } from "./routes/auth";
import { preferencesRoutes } from "./routes/preferences";
import { quotaRoutes } from "./routes/quota";
import { plantsRoutes } from "./routes/plants";
import { notificationsRoutes } from "./routes/notifications";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/quota", quotaRoutes);
app.use("/api/plants", plantsRoutes);
app.use("/api/notifications", notificationsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error("Error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Verdure API running on port ${PORT} (${NODE_ENV})`);
});

export default app;
