const mongoose = require("mongoose");

const inventoryUnitSchema = new mongoose.Schema({
  unitCode: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  bloodBankId: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank", required: true, index: true },
  group: { type: String, required: true, enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"], index: true },
  component: { type: String, required: true, enum: ["WholeBlood", "RedCells", "Platelets", "Plasma", "Cryoprecipitate"] },
  collectedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ["Available", "Reserved", "Issued", "Quarantined", "Recalled", "Expired", "Discarded"], default: "Quarantined", index: true },
  lastTestedAt: { type: Date, default: null },
  testStatus: { type: String, enum: ["Pending", "Passed", "Failed"], default: "Pending" },
  recallReason: { type: String, default: "", maxlength: 500 },
  notes: { type: String, default: "", maxlength: 1000 },
  createdBy: { type: String, default: "" },
  updatedBy: { type: String, default: "" }
}, { timestamps: true });

inventoryUnitSchema.index({ bloodBankId: 1, status: 1, expiresAt: 1 });
module.exports = mongoose.model("InventoryUnit", inventoryUnitSchema);
