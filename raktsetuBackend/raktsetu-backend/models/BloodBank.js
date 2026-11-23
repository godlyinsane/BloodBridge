const mongoose = require("mongoose");

const bloodBankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "", maxlength: 300 },
    lat: { type: Number, min: -90, max: 90, default: null },
    lng: { type: Number, min: -180, max: 180, default: null },
    openingHours: { type: String, trim: true, default: "", maxlength: 160 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BloodBank", bloodBankSchema);
