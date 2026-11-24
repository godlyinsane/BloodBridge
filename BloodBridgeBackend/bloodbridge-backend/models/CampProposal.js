const mongoose = require("mongoose");

const campProposalSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "CampOrganizer", default: null, index: true },
  organizationType: { type: String, required: true, trim: true, maxlength: 80 },
  organizationName: { type: String, required: true, trim: true, maxlength: 160 },
  organizerName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 25 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  location: { type: String, required: true, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 6, default: "" },
  date: { type: Date, required: true },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  expectedDonors: { type: Number, required: true, min: 1, max: 5000 },
  preferredBloodBank: { type: String, trim: true, maxlength: 160, default: "" },
  arrangement: { type: String, trim: true, maxlength: 100, default: "" },
  refreshments: { type: String, trim: true, maxlength: 100, default: "" },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  status: { type: String, enum: ["pending", "under_review", "approved", "rejected"], default: "pending", index: true },
  reviewReason: { type: String, trim: true, maxlength: 500, default: "" },
  publishedCampId: { type: mongoose.Schema.Types.ObjectId, ref: "DonationCamp", default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("CampProposal", campProposalSchema);
