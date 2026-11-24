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

const donorRoutes = require("./routes/donors");
const requestRoutes = require("./routes/requests");
const requesterRoutes = require("./routes/requesters");
const campRoutes = require("./routes/camps");
const campOrganizerRoutes = require("./routes/campOrganizers");
const authRoutes = require("./routes/auth");
const bloodBankRoutes = require("./routes/bloodBanks");
const registeredBloodBankRoutes = require("./routes/registeredBloodBanks");
const rareDonorRoutes = require("./routes/rareDonors");
const verificationRoutes = require("./routes/verification");
const advancedOpsRoutes = require("./routes/advancedOps");
const productivityRoutes = require("./routes/productivity");
const featureHubRoutes = require("./routes/featureHub");
const bloodListingsRoutes = require("./routes/bloodListings");
const Donor = require("./models/Donor");

async function cleanupLegacyDistrictDonors() {
  const migrations = mongoose.connection.collection("bloodbridge_migrations");
  const migrationId = "district-donors-cleanup-v2";
  const existing = await migrations.findOne({ _id: migrationId });
  if (existing?.status === "complete") return;
  const now = new Date();
  let lockResult;
  try {
    lockResult = await migrations.findOneAndUpdate(
      { _id: migrationId, $or: [
        { status: { $exists: false } },
        { status: "failed" },
        { lockedAt: { $lt: new Date(now.getTime() - 15 * 60 * 1000) } },
      ] },
      { $set: { status: "running", lockedAt: now } },
      { upsert: true, returnDocument: "after" }
    );
  } catch (error) {
    if (error.code === 11000) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const latest = await migrations.findOne({ _id: migrationId });
        if (latest?.status === "complete") return;
      }
      throw new Error("Previous synthetic donor records are still being cleaned up. Please retry shortly.");
    }
    throw error;
  }
  const lock = lockResult?.value || lockResult;
  if (!lock || lock.status !== "running") return;
  try {
    const legacyBilaspurPhones = Array.from({ length: 15 }, (_, index) => String(101 + index).padStart(10, "0"));
    await Donor.deleteMany({ $or: [{ isTestData: true }, { phone: { $in: legacyBilaspurPhones } }] });
    await migrations.updateOne(
      { _id: migrationId },
      { $set: { status: "complete", completedAt: new Date() }, $unset: { lockedAt: "" } }
    );
    console.log("Removed previous synthetic district donor records.");
  } catch (error) {
    await migrations.updateOne(
      { _id: migrationId },
      { $set: { status: "failed", failedAt: new Date(), failureMessage: error.message }, $unset: { lockedAt: "" } }
    );
    throw error;
  }
}

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
let cleanupPromise;
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
  if (!cleanupPromise) {
    cleanupPromise = cleanupLegacyDistrictDonors().catch((error) => {
      cleanupPromise = null;
      throw error;
    });
  }
  await cleanupPromise;
}

app.disable("x-powered-by");
// Trust the single reverse proxy in front of Vercel Functions so req.ip reflects the client.
app.set("trust proxy", 1);
app.use(cors({
  origin(origin, callback) {
    // Permit non-browser clients (for example, health checks) and configured frontends.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-bloodbridge-api-key"],
  maxAge: 600,
}));
app.use(express.json({ limit: "1mb" }));

// Liveness must work even when MongoDB is unavailable; readiness is checked
// separately below after the shared database/configuration middleware.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "alive",
    database: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown",
    runtime: process.env.VERCEL === "1" ? "serverless" : "node-server",
  });
});
app.get("/", (req, res) => {
  res.json({ status: "BloodBridge backend is running." });
});

// Vercel runs this Express app as a serverless function. Connect lazily and
// reuse Mongoose's connection across warm invocations.
app.use(async (req, res, next) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(503).json({ error: "Server configuration is incomplete: JWT_SECRET must contain at least 32 characters." });
  }
  try {
    await connectToDatabase();
    return next();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    return res.status(503).json({ error: "Database is temporarily unavailable. Check the server configuration." });
  }
});

// Readiness is reached only after JWT configuration and MongoDB are available.
app.get("/api/health/ready", (req, res) => {
  res.json({ status: "ready", database: "connected" });
});

app.use("/api/donors", donorRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/requesters", requesterRoutes);
app.use("/api/camps", campRoutes);
app.use("/api/camp-organizers", campOrganizerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/blood-banks", bloodBankRoutes);
app.use("/api/registered-blood-banks", registeredBloodBankRoutes);
app.use("/api/rare-donors", rareDonorRoutes);
app.use("/api/donors", verificationRoutes);
app.use("/api/advanced", advancedOpsRoutes);
app.use("/api/productivity", productivityRoutes);
app.use("/api/features", featureHubRoutes);
app.use("/api/donor-listings", bloodListingsRoutes);

// Consistent JSON errors for malformed JSON and unexpected middleware errors.
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

// Export the Express app for Vercel's serverless runtime. In local development,
// start the conventional long-running Express server.
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 5000;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = "bloodbridge-development-secret-key-32-chars-long";
  }
  connectToDatabase()
    .then(() => {
      app.listen(PORT, () => console.log(`BloodBridge backend listening on port ${PORT}`));
    })
    .catch((err) => {
      console.error("Server startup error:", err.message);
      process.exit(1);
    });
}

module.exports = app;
