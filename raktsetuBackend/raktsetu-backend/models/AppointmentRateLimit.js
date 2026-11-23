const mongoose = require("mongoose");

// Durable rate-limit buckets for public appointment booking. The client
// address is HMACed before storage; raw IP addresses are never persisted.
const appointmentRateLimitSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

appointmentRateLimitSchema.index({ fingerprint: 1, windowStart: 1 }, { unique: true });
appointmentRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AppointmentRateLimit", appointmentRateLimitSchema);
