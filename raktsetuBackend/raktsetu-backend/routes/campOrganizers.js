const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const CampOrganizer = require("../models/CampOrganizer");
const { sendOtp, checkOtp } = require("../utils/otp");
const requireCampOrganizer = require("../middleware/requireCampOrganizer");

const router = express.Router();
const cleanPhone = value => String(value || "").replace(/\D/g, "").slice(-10);
const publicProfile = user => ({
  _id: user._id, organizationType: user.organizationType,
  organizationName: user.organizationName, organizerName: user.organizerName,
  phone: user.phone, email: user.email, verified: Boolean(user.verifiedAt)
});
const tokenFor = user => jwt.sign(
  { id: user._id, phone: user.phone, role: "camp-organizer" },
  process.env.JWT_SECRET, { expiresIn: "30d" }
);

router.post("/register/send-otp", async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
    if (await CampOrganizer.findOne({ phone })) return res.status(409).json({ error: "An organizer account already uses this mobile number. Log in or use Forgot password." });
    const result = await sendOtp("camp-organizer:" + phone);
    return res.json({ message: "Demo verification code generated.", ...result });
  } catch { return res.status(500).json({ error: "Unable to generate a verification code right now." }); }
});

router.post("/register", async (req, res) => {
  try {
    const body = req.body || {};
    const phone = cleanPhone(body.phone);
    const organizationType = String(body.organizationType || "").trim();
    const organizationName = String(body.organizationName || "").trim();
    const organizerName = String(body.organizerName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = body.password;
    if (!organizationType || !organizationName || !organizerName || !email || !phone || !password) return res.status(400).json({ error: "Complete all organizer account fields." });
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!await checkOtp("camp-organizer:" + phone, body.otp)) return res.status(400).json({ error: "Incorrect or expired verification code. Request a new code." });
    const user = await CampOrganizer.create({
      organizationType: organizationType.slice(0, 80),
      organizationName: organizationName.slice(0, 160),
      organizerName: organizerName.slice(0, 100),
      phone, email: email.slice(0, 180),
      passwordHash: await bcrypt.hash(password, 10), verifiedAt: new Date()
    });
    return res.status(201).json({ organizer: publicProfile(user), token: tokenFor(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An account with this mobile number already exists. Please log in." });
    return res.status(500).json({ error: "Unable to create organizer account right now." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    const user = await CampOrganizer.findOne({ phone });
    if (!user || !await bcrypt.compare(String(req.body?.password || ""), user.passwordHash)) return res.status(401).json({ error: "Invalid mobile number or password." });
    return res.json({ organizer: publicProfile(user), token: tokenFor(user) });
  } catch { return res.status(500).json({ error: "Unable to log in right now." }); }
});

router.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
    const user = await CampOrganizer.findOne({ phone });
    if (!user) return res.status(404).json({ error: "No camp organizer account found with that mobile number." });
    const result = await sendOtp("camp-organizer:" + phone);
    return res.json({ message: "Demo password reset code generated.", ...result });
  } catch { return res.status(500).json({ error: "Unable to generate password reset code right now." }); }
});

router.post("/forgot-password/reset", async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    const { otp, newPassword } = req.body || {};
    if (!/^[6-9]\d{9}$/.test(phone) || !otp || typeof newPassword !== "string") return res.status(400).json({ error: "Mobile number, code and new password are required." });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
    const user = await CampOrganizer.findOne({ phone });
    if (!user) return res.status(404).json({ error: "No camp organizer account found with that mobile number." });
    if (!await checkOtp("camp-organizer:" + phone, otp)) return res.status(400).json({ error: "Incorrect or expired code. Request a new code." });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: "Password reset successfully. You can now log in." });
  } catch { return res.status(500).json({ error: "Unable to reset password right now." }); }
});

router.get("/me", requireCampOrganizer, async (req, res) => {
  const user = await CampOrganizer.findById(req.campOrganizer.id);
  if (!user) return res.status(404).json({ error: "Organizer account not found." });
  return res.json(publicProfile(user));
});

module.exports = router;
