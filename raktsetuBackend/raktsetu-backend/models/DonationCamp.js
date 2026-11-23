const mongoose = require("mongoose");

const campSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    organizer: { type: String, trim: true, default: "" },
    location: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    date: { type: Date, required: true },
    contactPhone: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true, default: "" },
    organizationType: { type: String, trim: true, default: "" },
    expectedDonors: { type: Number, min: 0, default: 0 },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    proposalReference: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DonationCamp", campSchema);
