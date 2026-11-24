const mongoose = require("mongoose");

const requesterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  district: { type: String, trim: true, maxlength: 100, default: "" },
  city: { type: String, trim: true, maxlength: 100, default: "" },
  state: { type: String, required: true, trim: true, maxlength: 100 },
}, { timestamps: true });

module.exports = mongoose.model("Requester", requesterSchema);
