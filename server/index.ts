import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, closeDb } from "./db.js";
import { verifyToken, hasPassword } from "./auth.js";
import authRoutes from "./routes/auth.js";
import storeRoutes from "./routes/store.js";
import aiRoutes from "./routes/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3001", 10);
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Auth routes (no auth required)
app.use("/api/auth", authRoutes);

// Auth middleware for all other /api routes
app.use("/api", (req, res, next) => {
  // Skip auth check and setup if no password is set
  if (!hasPassword()) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }

  next();
});

// API routes
app.use("/api/store", storeRoutes);
app.use("/api/ai", aiRoutes);

// Serve frontend in production
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Initialize DB and start server
getDb();
console.log("Database initialized");

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

// alwaysdata uses SIGHUP for hot restart
process.on("SIGHUP", () => {
  console.log("Restarting...");
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});
