const express = require("express");
const router = express.Router();
const DonationCamp = require("../models/DonationCamp");
const CampProposal = require("../models/CampProposal");
const requireAdmin = require("../middleware/requireAdmin");
const requireCampOrganizer = require("../middleware/requireCampOrganizer");


function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }

// Organisers submit a proposal; it is never listed publicly until reviewed.
router.post("/proposals", requireCampOrganizer, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const required = ["organizationType", "organizationName", "organizerName", "phone", "email", "title", "location", "city", "state", "date", "startTime", "endTime"];
  if (!required.every((key) => typeof body[key] === "string" && body[key].trim())) return res.status(400).json({ error: "Complete all required organiser and camp fields." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return res.status(400).json({ error: "Enter a valid organiser email address." });
  if (!/^[0-9+() -]{10,25}$/.test(body.phone.trim())) return res.status(400).json({ error: "Enter a valid contact phone number." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || new Date(body.date + "T23:59:59") < new Date()) return res.status(400).json({ error: "Choose a valid future camp date." });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime) || body.endTime <= body.startTime) return res.status(400).json({ error: "Enter a valid camp time range." });
  const expectedDonors = Number(body.expectedDonors);
  if (!Number.isInteger(expectedDonors) || expectedDonors < 1 || expectedDonors > 5000) return res.status(400).json({ error: "Expected donors must be between 1 and 5000." });
  if (body.postalCode && !/^\d{6}$/.test(String(body.postalCode))) return res.status(400).json({ error: "PIN code must contain 6 digits." });
  const reference = "RM-CAMP-" + require("crypto").randomBytes(4).toString("hex").toUpperCase();
  const proposal = await CampProposal.create({
    organizerId: req.campOrganizer.id,
    reference, organizationType: body.organizationType.trim().slice(0, 80),
    organizationName: body.organizationName.trim().slice(0, 160), organizerName: body.organizerName.trim().slice(0, 100),
    phone: body.phone.trim().slice(0, 25), email: body.email.trim().toLowerCase().slice(0, 180),
    title: body.title.trim().slice(0, 160), location: body.location.trim().slice(0, 300),
    city: body.city.trim().slice(0, 100), state: body.state.trim().slice(0, 100),
    postalCode: String(body.postalCode || "").trim(), date: new Date(body.date + "T12:00:00"),
    startTime: body.startTime, endTime: body.endTime, expectedDonors,
    preferredBloodBank: String(body.preferredBloodBank || "").trim().slice(0, 160),
    arrangement: String(body.arrangement || "").trim().slice(0, 100),
    refreshments: String(body.refreshments || "").trim().slice(0, 100),
    notes: String(body.notes || "").trim().slice(0, 1000)
  });
  res.status(201).json({ message: "Camp proposal submitted for review.", reference: proposal.reference, status: proposal.status });
}));

router.get("/proposals/mine", requireCampOrganizer, asyncRoute(async (req, res) => {
  const proposals = await CampProposal.find({ organizerId: req.campOrganizer.id })
    .sort({ createdAt: -1 }).limit(100).lean();
  res.json(proposals.map(p => ({
    _id: p._id, reference: p.reference, title: p.title, organizationName: p.organizationName,
    city: p.city, state: p.state, date: p.date, expectedDonors: p.expectedDonors,
    status: p.status, reviewReason: p.reviewReason, createdAt: p.createdAt,
    startTime: p.startTime, endTime: p.endTime, location: p.location
  })));
}));

router.get("/proposals/admin", requireAdmin, asyncRoute(async (req, res) => {
  const proposals = await CampProposal.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json(proposals);
}));

router.patch("/proposals/:id/review", requireAdmin, asyncRoute(async (req, res) => {
  const { action, reason = "" } = req.body || {};
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Choose approve or reject." });
  const proposal = await CampProposal.findById(req.params.id);
  if (!proposal) return res.status(404).json({ error: "Camp proposal not found." });
  if (proposal.status === "approved") return res.status(409).json({ error: "This proposal has already been approved." });
  if (action === "reject") {
    proposal.status = "rejected"; proposal.reviewReason = String(reason).trim().slice(0, 500);
  } else {
    const camp = await DonationCamp.create({
      title: proposal.title, organizer: proposal.organizationName,
      location: proposal.location, city: proposal.city, state: proposal.state,
      date: proposal.date, contactPhone: proposal.phone, contactEmail: proposal.email,
      organizationType: proposal.organizationType, expectedDonors: proposal.expectedDonors,
      startTime: proposal.startTime, endTime: proposal.endTime, proposalReference: proposal.reference
    });
    proposal.status = "approved"; proposal.reviewReason = ""; proposal.publishedCampId = camp._id;
  }
  proposal.reviewedAt = new Date();
  proposal.reviewedBy = req.admin?.username || "admin";
  await proposal.save();
  res.json({ message: action === "approve" ? "Camp approved and published." : "Proposal returned for changes.", proposal: { id: proposal._id, reference: proposal.reference, status: proposal.status, reviewReason: proposal.reviewReason } });
}));

// GET all camps, soonest first
router.get("/", async (req, res) => {
  try {
    const camps = await DonationCamp.find().sort({ date: 1 });
    res.json(camps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a camp (admin only)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { title, organizer, location, city, state, date, contactPhone } = req.body;
    if (!title || !location || !date) {
      return res.status(400).json({ error: "Title, location, and date are required." });
    }
    const camp = new DonationCamp({ title, organizer, location, city, state, date, contactPhone });
    await camp.save();
    res.status(201).json(camp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a camp (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await DonationCamp.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
