const mongoose = require("mongoose");

const rareDonorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    rareType: {
      type: String,
      required: true,
      enum: ["Bombay Blood Group (hh)", "Rh-null (Golden Blood)"],
    },
    gender: { type: String, required: true, enum: ["Male", "Female", "Other"] },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    available: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    lastDonation: { type: Date, default: () => new Date("2020-01-01") },
    totalDonations: { type: Number, default: 0 },
    donationType: { type: String, enum: ["Free", "Paid"], default: "Free" },
    feeAmount: { type: Number, default: 0 },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RareDonor", rareDonorSchema);
