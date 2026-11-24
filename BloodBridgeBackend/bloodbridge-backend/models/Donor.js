const mongoose = require("mongoose");

const donorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    group: {
      type: String,
      required: true,
      enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
    },
    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other"],
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    district: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    locality: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    available: { type: Boolean, default: true },
    // Synthetic records used only for project testing; not real donor identities.
    isTestData: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    lastDonation: { type: Date, default: () => new Date("2020-01-01") },
    totalDonations: { type: Number, default: 0 },
    passwordHash: { type: String, required: true },
    // Donation preference: most platforms (and Indian law) expect voluntary,
    // non-remunerated donation; "Paid" here means the donor expects reimbursement
    // for travel/time, not a cash sale of blood, which is illegal in India.
    donationType: { type: String, enum: ["Free", "Paid"], default: "Free" },
    feeAmount: { type: Number, default: 0 },

    // --- Blood group document verification (separate from phone/OTP `verified` above) ---
    bloodGroupStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    bloodGroupDocPath: { type: String, default: "" }, // server-side path only, never sent to non-admins
    bloodGroupDocOriginalName: { type: String, default: "" },
    bloodGroupVerifiedBy: { type: String, default: "" }, // admin username
    bloodGroupVerifiedAt: { type: Date, default: null },
    bloodGroupRejectionReason: { type: String, default: "" },
    bloodGroupReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donor", donorSchema);
