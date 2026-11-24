const mongoose = require("mongoose");

const rareDonationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "RareDonor", required: true },
    donationDate: { type: Date, default: Date.now },
    patientName: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    hospitalName: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["Blood", "Platelets", "Plasma"], default: "Blood" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RareDonation", rareDonationSchema);
