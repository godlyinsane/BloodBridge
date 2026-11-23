const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "Requester", index: true },
    requesterName: { type: String, trim: true, default: "" },
    requesterPhone: { type: String, trim: true, default: "" },
    recipient: { type: String, required: true, trim: true },
    group: {
      type: String,
      required: true,
      enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
    },
    units: { type: Number, default: 1 },
    urgency: { type: String, enum: ["Normal", "High"], default: "Normal" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    district: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["Open", "Matched", "Fulfilled"], default: "Open" },
    matchedDonorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Donor" }],
    statusHistory: [{ status: { type: String, enum: ["Open", "Matched", "Fulfilled"], required: true }, note: { type: String, default: "", maxlength: 240 }, changedBy: { type: String, default: "" }, changedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BloodRequest", requestSchema);
