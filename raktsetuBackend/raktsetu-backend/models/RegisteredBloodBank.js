const mongoose = require("mongoose");

const inventoryUnitSchema = new mongoose.Schema({
  group: { type: String, enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"], required: true },
  component: { type: String, enum: ["Whole Blood", "Packed Red Cells", "Platelets", "Fresh Frozen Plasma", "Cryoprecipitate"], required: true },
  units: { type: Number, min: 0, required: true, default: 0 },
  collectedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  batchCode: { type: String, trim: true, maxlength: 80, default: "" },
  status: { type: String, enum: ["available", "quarantined", "expired", "discarded"], default: "available" },
  updatedBy: { type: String, default: "" }
}, { timestamps: true });

const registeredBloodBankSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  licenseNumber: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  passwordHash: { type: String, required: true },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  district: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["pending", "verified", "rejected", "suspended"], default: "pending", index: true },
  documents: [{
    kind: { type: String, enum: ["blood_bank_license", "state_noc", "accreditation", "other"], required: true },
    originalName: { type: String, trim: true, maxlength: 200, required: true },
    mimeType: { type: String, trim: true, maxlength: 100, required: true },
    contentBase64: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    reviewStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: { type: String, maxlength: 500, default: "" }
  }],
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: String, default: "" },
  rejectionReason: { type: String, maxlength: 500, default: "" },
  inventory: [inventoryUnitSchema],
  lastInventoryUpdate: { type: Date, default: null }
}, { timestamps: true });

registeredBloodBankSchema.index({ state: 1, district: 1, status: 1 });
module.exports = mongoose.model("RegisteredBloodBank", registeredBloodBankSchema);
