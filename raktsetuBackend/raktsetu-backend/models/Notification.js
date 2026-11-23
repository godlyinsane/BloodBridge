const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "Donor", required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["verification_status", "verification_reminder", "general"],
      default: "general",
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
