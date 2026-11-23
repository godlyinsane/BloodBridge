const mongoose = require("mongoose");
const appointmentSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "Donor", default: null, index: true },
  donorName: { type: String, required: true, trim: true, maxlength: 120 },
  contact: { type: String, default: "", maxlength: 80 },
  bloodBankName: { type: String, required: true, trim: true, maxlength: 160 },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ["Booked", "Confirmed", "Completed", "Cancelled", "No-show"], default: "Booked", index: true },
  notes: { type: String, default: "", maxlength: 300 },
  clientReference: { type: String, trim: true, unique: true, sparse: true, maxlength: 80 },
  createdBy: { type: String, default: "" },
  updatedBy: { type: String, default: "" }
}, { timestamps: true });
appointmentSchema.index({ scheduledAt: 1, status: 1 });
module.exports = mongoose.model("Appointment", appointmentSchema);
