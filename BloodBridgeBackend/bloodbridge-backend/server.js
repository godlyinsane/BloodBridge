require("dotenv").config();

// Enable JSON-file database engine when no MONGO_URI is configured
if (!process.env.MONGO_URI) {
  try {
    const resolvedMongoose = require.resolve("mongoose");
    const jsonMongoose = require("./utils/jsonMongoose");
    require.cache[resolvedMongoose] = {
      id: resolvedMongoose,
      filename: resolvedMongoose,
      loaded: true,
      exports: jsonMongoose,
    };
  } catch (e) {
    console.warn("Notice loading JSON storage:", e.message);
  }
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const campRoutes = require("./routes/camps");
const bloodBankRoutes = require("./routes/bloodBanks");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://blood-bank-mern-xi.vercel.app",
  "https://blood-bank-mern-gold.vercel.app",
  "https://blood-bank-mern.vercel.app",
  ...(process.env.CLIENT_ORIGIN || "").split(","),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
].map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);

let databaseConnection;
async function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    // JSON-file storage is ready immediately
    return;
  }
  if (mongoose.connection.readyState !== 1) {
    if (!databaseConnection) {
      databaseConnection = mongoose.connect(process.env.MONGO_URI).catch((error) => {
        databaseConnection = null;
        throw error;
      });
    }
    await databaseConnection;
  }
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));
app.use(express.json({ limit: "1mb" }));

// Health endpoints
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "alive",
    database: !process.env.MONGO_URI ? "local-json" : (["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown"),
    runtime: process.env.VERCEL === "1" ? "serverless" : "node-server",
  });
});

app.get("/", (req, res) => {
  res.json({ status: "BloodBridge backend is running." });
});

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    return next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    return res.status(503).json({ error: "Database is temporarily unavailable." });
  }
});

app.get("/api/health/ready", (req, res) => {
  res.json({ status: "ready", database: "connected" });
});

// Public directory routes
app.use("/api/camps", campRoutes);
app.use("/api/blood-banks", bloodBankRoutes);

// Consistent JSON errors
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Request body must contain valid JSON." });
  }
  if (err.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ error: "This origin is not allowed to access the API." });
  }
  console.error("Unhandled API error:", err.message);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

const PORT = process.env.PORT || 5000;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`BloodBridge backend running on port ${PORT}`);
  });
}

module.exports = app;
