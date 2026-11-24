const mongoose = require("mongoose");

const campOrganizerSchema = new mongoose.Schema({
  organizationType: { type: String, required: true, trim: true, maxlength: 80 },
  organizationName: { type: String, required: true, trim: true, maxlength: 160 },
  organizerName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
  passwordHash: { type: String, required: true },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model("CampOrganizer", campOrganizerSchema);
