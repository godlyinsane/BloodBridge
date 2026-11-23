const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const RareDonor = require("../models/RareDonor");
const RareDonation = require("../models/RareDonation");
const { sendOtp, checkOtp } = require("../utils/otp");
const { haversineKm } = require("../utils/matching");
const requireAdmin = require("../middleware/requireAdmin");
const requireRareDonor = require("../middleware/requireRareDonor");

function signToken(donor) {
  return jwt.sign({ id: donor._id, phone: donor.phone, role: "rareDonor" }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

// GET all rare donors (public directory)
router.get("/", async (req, res) => {
  try {
    const donors = await RareDonor.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rare-donors/search?rareType=&lat=&lng=  — find other rare donors of the same type, ranked by distance
router.get("/search", async (req, res) => {
  try {
    const { rareType, lat, lng } = req.query;
    if (!rareType || lat == null || lng == null) {
      return res.status(400).json({ error: "rareType, lat, and lng are required." });
    }
    const candidates = await RareDonor.find({ rareType, verified: true, available: true }).select("-passwordHash");
    const ranked = candidates
      .map((d) => ({ ...d.toObject(), distanceKm: haversineKm(parseFloat(lat), parseFloat(lng), d.lat, d.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rare-donors/send-otp  { phone }
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });
    const result = await sendOtp(phone);
    res.json({ message: "OTP sent.", ...result });
  } catch (err) {
    if (err.code === 60203 || /unverified/i.test(err.message)) {
      return res.status(400).json({ error: "This number isn't verified on your Twilio trial account." });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rare-donors/register
router.post("/register", async (req, res) => {
  try {
    const { name, phone, password, rareType, gender, lat, lng, city, state, donationType, feeAmount, otp } = req.body;
    if (!name || !phone || !password || !rareType || !gender || lat == null || lng == null || !otp) {
      return res.status(400).json({ error: "All fields including rare type, gender, password, location, and OTP are required." });
    }
    const hasCoordinate = (value) => value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
    const numericLat = Number(lat);
    const numericLng = Number(lng);
    if (!hasCoordinate(lat) || !hasCoordinate(lng) ||
        !Number.isFinite(numericLat) || numericLat < -90 || numericLat > 90 ||
        !Number.isFinite(numericLng) || numericLng < -180 || numericLng > 180) {
      return res.status(400).json({ error: "Enter valid latitude and longitude coordinates." });
    }
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const isValid = await checkOtp(phone, otp);
    if (!isValid) return res.status(400).json({ error: "Incorrect or expired OTP." });

    const safeDonationType = donationType === "Paid" ? "Paid" : "Free";
    const safeFee = safeDonationType === "Paid" ? Number(feeAmount) || 0 : 0;
    const passwordHash = await bcrypt.hash(password, 10);

    let donor = await RareDonor.findOne({ phone });
    if (donor) {
      donor.name = name;
      donor.rareType = rareType;
      donor.gender = gender;
      donor.lat = lat;
      donor.lng = lng;
      donor.city = city || donor.city;
      donor.state = state || donor.state;
      donor.donationType = safeDonationType;
      donor.feeAmount = safeFee;
      donor.passwordHash = passwordHash;
      donor.verified = true;
    } else {
      donor = new RareDonor({
        name, phone, rareType, gender, lat, lng, city, state,
        donationType: safeDonationType, feeAmount: safeFee, passwordHash, verified: true,
      });
    }
    await donor.save();
    const token = signToken(donor);
    const { passwordHash: _omit, ...safeDonor } = donor.toObject();
    res.status(201).json({ donor: safeDonor, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rare-donors/login  { phone, password }
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "Phone and password are required." });

    const donor = await RareDonor.findOne({ phone });
    if (!donor) return res.status(401).json({ error: "Invalid phone number or password." });

    const match = await bcrypt.compare(password, donor.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid phone number or password." });

    const token = signToken(donor);
    const { passwordHash: _omit, ...safeDonor } = donor.toObject();
    res.json({ donor: safeDonor, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rare-donors/me
router.get("/me", requireRareDonor, async (req, res) => {
  try {
    const donor = await RareDonor.findById(req.rareDonor.id).select("-passwordHash");
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rare-donors/:id/availability
router.patch("/:id/availability", requireRareDonor, async (req, res) => {
  try {
    if (req.rareDonor.id !== req.params.id) return res.status(403).json({ error: "You can only update your own availability." });
    const donor = await RareDonor.findByIdAndUpdate(req.params.id, { available: req.body.available }, { new: true }).select("-passwordHash");
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rare-donors/:id/profile
router.patch("/:id/profile", requireRareDonor, async (req, res) => {
  try {
    if (req.rareDonor.id !== req.params.id) return res.status(403).json({ error: "You can only edit your own profile." });
    const { name, rareType, gender, city, state, lat, lng, donationType, feeAmount } = req.body;
    const donor = await RareDonor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });

    if (name) donor.name = name;
    if (rareType) donor.rareType = rareType;
    if (gender) donor.gender = gender;
    if (city !== undefined) donor.city = city;
    if (state !== undefined) donor.state = state;
    if (lat != null) donor.lat = lat;
    if (lng != null) donor.lng = lng;
    if (donationType) {
      donor.donationType = donationType === "Paid" ? "Paid" : "Free";
      donor.feeAmount = donor.donationType === "Paid" ? Number(feeAmount) || 0 : 0;
    }

    await donor.save();
    const { passwordHash: _omit, ...safeDonor } = donor.toObject();
    res.json(safeDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rare-donors/:id/password
router.patch("/:id/password", requireRareDonor, async (req, res) => {
  try {
    if (req.rareDonor.id !== req.params.id) return res.status(403).json({ error: "You can only change your own password." });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new password are required." });
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

    const donor = await RareDonor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });

    const match = await bcrypt.compare(currentPassword, donor.passwordHash);
    if (!match) return res.status(401).json({ error: "Current password is incorrect." });

    donor.passwordHash = await bcrypt.hash(newPassword, 10);
    await donor.save();
    res.json({ message: "Password updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rare-donors/forgot-password/send-otp  { phone }
router.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });
    const donor = await RareDonor.findOne({ phone });
    if (!donor) return res.status(404).json({ error: "No account found with that phone number." });
    const result = await sendOtp(phone);
    res.json({ message: "OTP sent.", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rare-donors/forgot-password/reset  { phone, otp, newPassword }
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) return res.status(400).json({ error: "Phone, OTP, and new password are required." });
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

    const isValid = await checkOtp(phone, otp);
    if (!isValid) return res.status(400).json({ error: "Incorrect or expired OTP." });

    const donor = await RareDonor.findOne({ phone });
    if (!donor) return res.status(404).json({ error: "No account found with that phone number." });

    donor.passwordHash = await bcrypt.hash(newPassword, 10);
    await donor.save();
    res.json({ message: "Password reset. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rare-donors/:id/donations
router.post("/:id/donations", requireRareDonor, async (req, res) => {
  try {
    if (req.rareDonor.id !== req.params.id) return res.status(403).json({ error: "You can only register your own donations." });
    const { donationDate, patientName, location, hospitalName, type } = req.body;
    if (!donationDate) return res.status(400).json({ error: "Donated date is required." });

    const donation = await RareDonation.create({
      donorId: req.params.id, donationDate: new Date(donationDate),
      patientName, location, hospitalName, type: type || "Blood",
    });

    const donor = await RareDonor.findById(req.params.id);
    if (donor) {
      const newDate = new Date(donationDate);
      if (!donor.lastDonation || newDate > new Date(donor.lastDonation)) donor.lastDonation = newDate;
      donor.totalDonations = (donor.totalDonations || 0) + 1;
      await donor.save();
    }
    res.status(201).json(donation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rare-donors/:id/donations
router.get("/:id/donations", requireRareDonor, async (req, res) => {
  try {
    if (req.rareDonor.id !== req.params.id) return res.status(403).json({ error: "You can only view your own donation history." });
    const donations = await RareDonation.find({ donorId: req.params.id }).sort({ donationDate: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rare-donors/:id
router.delete("/:id", requireRareDonor, async (req, res) => {
  try {
    if (req.rareDonor.id !== req.params.id) return res.status(403).json({ error: "You can only delete your own profile." });
    await RareDonor.findByIdAndDelete(req.params.id);
    await RareDonation.deleteMany({ donorId: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rare-donors/:id/verify  (admin only)
router.patch("/:id/verify", requireAdmin, async (req, res) => {
  try {
    const donor = await RareDonor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    donor.verified = !donor.verified;
    await donor.save();
    const { passwordHash: _omit, ...safeDonor } = donor.toObject();
    res.json(safeDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
