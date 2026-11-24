const mongoose = require("mongoose");

const bloodBankInventorySchema = new mongoose.Schema(
  {
    group: { type: String, enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] },
    component: { type: String, default: "Whole Blood" },
    units: { type: Number, min: 0, default: 0 },
    batchCode: { type: String, default: "" },
    status: { type: String, default: "available" },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const bloodBankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "Madhya Pradesh" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "", maxlength: 500 },
    category: { type: String, trim: true, default: "Government" },
    facilityType: { type: String, trim: true, default: "Blood Bank" },
    serviceCategory: { type: String, trim: true, default: "Both (Need Blood & Donate)" },
    components: { type: String, trim: true, default: "Whole Blood" },
    lat: { type: Number, min: -90, max: 90, default: null },
    lng: { type: Number, min: -180, max: 180, default: null },
    openingHours: { type: String, trim: true, default: "24x7 Emergency Services", maxlength: 200 },
    verified: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" },
    inventory: [bloodBankInventorySchema],
    lastInventoryUpdate: { type: Date, default: null },
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model("BloodBank", bloodBankSchema);

