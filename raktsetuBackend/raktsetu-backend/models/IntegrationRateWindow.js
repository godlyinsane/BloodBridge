const mongoose = require("mongoose");

const integrationRateWindowSchema = new mongoose.Schema({
  keyId: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationKey", required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

integrationRateWindowSchema.index({ keyId: 1, windowStart: 1 }, { unique: true });
integrationRateWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("IntegrationRateWindow", integrationRateWindowSchema);
