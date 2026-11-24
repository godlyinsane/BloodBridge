const mongoose = require("mongoose");

const bloodListingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    area: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verificationMethod: {
      type: String,
      enum: ["otp", "admin"],
      default: "otp",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    ip: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

bloodListingSchema.index({ status: 1, bloodGroup: 1, createdAt: -1 });
bloodListingSchema.index({ city: 1, area: 1 });

module.exports = mongoose.model("BloodListing", bloodListingSchema);
