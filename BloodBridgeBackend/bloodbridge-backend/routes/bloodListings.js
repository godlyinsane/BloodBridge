const express = require("express");
const router = express.Router();
const BloodListing = require("../models/BloodListing");
const { sendOtp, checkOtp } = require("../utils/otp");
const requireAdmin = require("../middleware/requireAdmin");

const ALLOWED_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const sanitizePhone = (val) => String(val || "").replace(/\D/g, "").slice(-10);
const isValidMobile = (val) => /^[6-9]\d{9}$/.test(val);

function maskPhoneNumber(phone) {
  const clean = sanitizePhone(phone);
  if (clean.length === 10) {
    return clean.slice(0, 2) + "xxxxxx" + clean.slice(-2);
  }
  return "xxxxxxxxxx";
}

// POST /api/donor-listings/send-otp
// Sends verification OTP for listing creation
router.post("/send-otp", async (req, res) => {
  try {
    const rawPhone = req.body?.phone;
    const phone = sanitizePhone(rawPhone);
    if (!isValidMobile(phone)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
    }
    const result = await sendOtp(phone);
    res.json({ message: "Verification OTP generated.", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unable to send verification OTP." });
  }
});

// POST /api/donor-listings/verify-and-create
// Verifies phone OTP and publishes verified listing immediately
router.post("/verify-and-create", async (req, res) => {
  try {
    const { name, bloodGroup, city, area, phone: rawPhone, notes, otp } = req.body || {};
    const phone = sanitizePhone(rawPhone);

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Donor contact name is required." });
    }
    if (!ALLOWED_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ error: "Please select a valid blood group." });
    }
    if (!city || !String(city).trim()) {
      return res.status(400).json({ error: "City or district is required." });
    }
    if (!isValidMobile(phone)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
    }
    if (!otp || String(otp).trim().length < 4) {
      return res.status(400).json({ error: "Valid 4-digit verification OTP is required." });
    }

    const isValid = await checkOtp(phone, otp);
    if (!isValid) {
      return res.status(400).json({ error: "Incorrect or expired verification code." });
    }

    const listing = await BloodListing.create({
      name: String(name).trim().slice(0, 100),
      bloodGroup,
      city: String(city).trim().slice(0, 100),
      area: String(area || "").trim().slice(0, 150),
      phone,
      notes: String(notes || "").trim().slice(0, 300),
      status: "verified",
      verificationMethod: "otp",
      verifiedAt: new Date(),
      ip: req.ip || "",
    });

    const safeObj = listing.toObject();
    safeObj.phoneMasked = maskPhoneNumber(safeObj.phone);
    delete safeObj.phone;
    delete safeObj.ip;

    res.status(201).json({
      message: "Blood availability listing verified and published successfully.",
      listing: safeObj,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create blood availability listing." });
  }
});

// POST /api/donor-listings/submit-pending
// Optional submission waiting for administrative review
router.post("/submit-pending", async (req, res) => {
  try {
    const { name, bloodGroup, city, area, phone: rawPhone, notes } = req.body || {};
    const phone = sanitizePhone(rawPhone);

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Contact name is required." });
    }
    if (!ALLOWED_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ error: "Please select a valid blood group." });
    }
    if (!city || !String(city).trim()) {
      return res.status(400).json({ error: "City/district is required." });
    }
    if (!isValidMobile(phone)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
    }

    const listing = await BloodListing.create({
      name: String(name).trim().slice(0, 100),
      bloodGroup,
      city: String(city).trim().slice(0, 100),
      area: String(area || "").trim().slice(0, 150),
      phone,
      notes: String(notes || "").trim().slice(0, 300),
      status: "pending",
      verificationMethod: "admin",
      ip: req.ip || "",
    });

    res.status(201).json({
      message: "Listing submitted for verification. It will appear publicly once verified.",
      status: listing.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to submit listing." });
  }
});

// GET /api/donor-listings/public
// Returns only verified listings, sorted by newest first, with blood group & location filtering
router.get("/public", async (req, res) => {
  try {
    const { group, city, q } = req.query;
    const filter = { status: "verified" };

    if (group && ALLOWED_GROUPS.includes(group)) {
      filter.bloodGroup = group;
    }

    const searchTerm = String(city || q || "").trim();
    if (searchTerm) {
      const escapeRegex = (s) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escapeRegex(searchTerm), "i");
      filter.$or = [{ city: pattern }, { area: pattern }];
    }

    const rawListings = await BloodListing.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const listings = rawListings.map((item) => ({
      _id: item._id,
      name: item.name,
      bloodGroup: item.bloodGroup,
      city: item.city,
      area: item.area,
      notes: item.notes,
      createdAt: item.createdAt,
      verifiedAt: item.verifiedAt,
      phoneMasked: maskPhoneNumber(item.phone),
      hasContact: Boolean(item.phone),
    }));

    res.json({
      count: listings.length,
      listings,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch public blood listings." });
  }
});

// POST /api/donor-listings/:id/reveal-contact
// Reveals phone & WhatsApp contact link upon explicit user action
router.post("/:id/reveal-contact", async (req, res) => {
  try {
    const listing = await BloodListing.findOne({ _id: req.params.id, status: "verified" });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found or not yet verified." });
    }

    const cleanPhone = sanitizePhone(listing.phone);
    const intlPhone = cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone;
    const prefilledText = encodeURIComponent(
      `Hello ${listing.name}, I saw your blood availability listing (${listing.bloodGroup}) on BloodBridge and would like to connect.`
    );

    res.json({
      phone: cleanPhone,
      phoneFormatted: `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`,
      callUrl: `tel:+91${cleanPhone}`,
      whatsAppUrl: `https://wa.me/${intlPhone}?text=${prefilledText}`,
      disclaimer: "Please verify blood group and availability directly with the donor and medical facility before travelling.",
    });
  } catch (err) {
    res.status(500).json({ error: "Unable to reveal contact information." });
  }
});

// GET /api/donor-listings/admin/all
// Admin dashboard view of all pending, verified and rejected listings
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const listings = await BloodListing.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin listings." });
  }
});

// PATCH /api/donor-listings/:id/status
// Admin status update (pending -> verified/rejected)
router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "verified", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }
    const update = { status };
    if (status === "verified") {
      update.verifiedAt = new Date();
    }
    const updated = await BloodListing.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!updated) return res.status(404).json({ error: "Listing not found." });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update listing status." });
  }
});

module.exports = router;
