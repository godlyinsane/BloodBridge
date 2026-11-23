const mongoose = require("mongoose");

const integrationKeySchema = new mongoose.Schema({
  organizationName: { type: String, required: true, trim: true, maxlength: 160 },
  keyHash: { type: String, required: true, unique: true, select: false },
  scopes: [{ type: String, enum: ["requests:read", "inventory:read", "inventory:write"] }],
  active: { type: Boolean, default: true, index: true },
  expiresAt: { type: Date, default: null },
  createdBy: { type: String, default: "" },
  lastUsedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model("IntegrationKey", integrationKeySchema);
