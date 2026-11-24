const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const requireAdmin = require("../middleware/requireAdmin");
const BloodRequest = require("../models/BloodRequest");
const Donor = require("../models/Donor");
const InventoryUnit = require("../models/InventoryUnit");
const Appointment = require("../models/Appointment");
const OperationsAudit = require("../models/OperationsAudit");

const GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const safeId = (id) => mongoose.isValidObjectId(id);
const actor = (req) => String(req.admin?.username || req.admin?.id || "admin").slice(0, 160);
async function audit(req, action, resourceId, metadata = {}) {
  await OperationsAudit.create({ actor: actor(req), action, resourceType: "operations", resourceId: String(resourceId || ""), metadata });
}

// Aggregated location data only; never returns recipient names or exact coordinates.
router.get("/heatmap", requireAdmin, async (req, res) => {
  try {
    const rows = await BloodRequest.aggregate([
      { $match: { status: { $ne: "Fulfilled" } } },
      { $group: { _id: { city: "$city", state: "$state", group: "$group" }, requests: { $sum: 1 }, units: { $sum: "$units" }, urgent: { $sum: { $cond: [{ $eq: ["$urgency", "High"] }, 1, 0] } } } },
      { $sort: { urgent: -1, units: -1 } }, { $limit: 250 }
    ]);
    res.json(rows.map((r) => ({ city: r._id.city || "Unspecified", state: r._id.state || "", group: r._id.group, requests: r.requests, units: r.units, urgent: r.urgent, level: r.urgent > 0 || r.units >= 5 ? "High" : r.units >= 2 ? "Moderate" : "Lower" })));
  } catch (err) { console.error("Heatmap failed:", err.message); res.status(500).json({ error: "Unable to load shortage heatmap." }); }
});

// Public tracking returns only status milestones, never recipient/contact/location fields.
router.get("/tracking/:id", async (req, res) => {
  try {
    if (!safeId(req.params.id)) return res.status(400).json({ error: "Invalid request reference." });
    const r = await BloodRequest.findById(req.params.id).select("group units urgency status statusHistory createdAt updatedAt").lean();
    if (!r) return res.status(404).json({ error: "Request not found." });
    res.json({ reference: String(r._id).slice(-8).toUpperCase(), group: r.group, units: r.units, urgency: r.urgency, status: r.status, milestones: r.statusHistory || [], createdAt: r.createdAt, updatedAt: r.updatedAt });
  } catch (err) { console.error("Tracking lookup failed:", err.message); res.status(500).json({ error: "Unable to load request tracking." }); }
});
router.patch("/tracking/:id", requireAdmin, async (req, res) => {
  try {
    if (!safeId(req.params.id)) return res.status(400).json({ error: "Invalid request reference." });
    const status = String(req.body?.status || "");
    if (!["Open", "Matched", "Fulfilled"].includes(status)) return res.status(400).json({ error: "Status must be Open, Matched, or Fulfilled." });
    const r = await BloodRequest.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Request not found." });
    if (r.status === "Fulfilled" && status !== "Fulfilled") return res.status(409).json({ error: "Fulfilled requests cannot be reopened from tracking." });
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 240) : "";
    r.status = status;
    r.statusHistory = Array.isArray(r.statusHistory) ? r.statusHistory : [];
    r.statusHistory.push({ status, note, changedBy: actor(req), changedAt: new Date() });
    await r.save();
    await audit(req, "request_status_changed", r._id, { status });
    res.json({ success: true, status: r.status, milestones: r.statusHistory });
  } catch (err) { console.error("Tracking update failed:", err.message); res.status(500).json({ error: "Unable to update request status." }); }
});

// Donation appointment slots. This is an operational booking record, not medical clearance.
router.get("/appointments", requireAdmin, async (req, res) => {
  try { res.json(await Appointment.find().sort({ scheduledAt: 1 }).limit(500).lean()); }
  catch (err) { console.error("Appointments failed:", err.message); res.status(500).json({ error: "Unable to load appointments." }); }
});
router.post("/appointments", requireAdmin, async (req, res) => {
  try {
    const { donorName, contact, bloodBankName, scheduledAt, notes = "" } = req.body || {};
    if (typeof donorName !== "string" || !donorName.trim() || donorName.trim().length > 120) return res.status(400).json({ error: "Donor name is required (max 120 characters)." });
    if (typeof bloodBankName !== "string" || !bloodBankName.trim() || bloodBankName.trim().length > 160) return res.status(400).json({ error: "Blood bank or camp name is required." });
    if (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime()) || new Date(scheduledAt) <= new Date()) return res.status(400).json({ error: "Choose a future appointment time." });
    const cleanContact = typeof contact === "string" ? contact.trim().slice(0, 80) : "";
    const row = await Appointment.create({ donorName: donorName.trim(), contact: cleanContact, bloodBankName: bloodBankName.trim(), scheduledAt: new Date(scheduledAt), notes: typeof notes === "string" ? notes.trim().slice(0, 300) : "", createdBy: actor(req) });
    await audit(req, "appointment_created", row._id, { bloodBankName: row.bloodBankName });
    res.status(201).json(row);
  } catch (err) { console.error("Appointment create failed:", err.message); res.status(500).json({ error: "Unable to create appointment." }); }
});
router.patch("/appointments/:id", requireAdmin, async (req, res) => {
  try {
    if (!safeId(req.params.id)) return res.status(400).json({ error: "Invalid appointment reference." });
    const status = String(req.body?.status || "");
    if (!["Booked", "Confirmed", "Completed", "Cancelled", "No-show"].includes(status)) return res.status(400).json({ error: "Invalid appointment status." });
    const row = await Appointment.findByIdAndUpdate(req.params.id, { $set: { status, updatedBy: actor(req) } }, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "Appointment not found." });
    await audit(req, "appointment_status_changed", row._id, { status });
    res.json(row);
  } catch (err) { console.error("Appointment update failed:", err.message); res.status(500).json({ error: "Unable to update appointment." }); }
});

// Alerts are derived from live inventory/request data; acknowledgements are auditable.
router.get("/alerts", requireAdmin, async (req, res) => {
  try {
    const now = new Date(), soon = new Date(Date.now() + 7 * 86400000);
    const [expiring, expired, quarantined, recalled, urgentRequests] = await Promise.all([
      InventoryUnit.find({ status: "Available", expiresAt: { $gt: now, $lte: soon } }).select("unitCode group expiresAt bloodBankId").populate("bloodBankId", "name city").lean(),
      InventoryUnit.find({ status: { $nin: ["Discarded", "Expired"] }, expiresAt: { $lte: now } }).select("unitCode group expiresAt status").lean(),
      InventoryUnit.find({ status: "Quarantined" }).select("unitCode group testStatus expiresAt").lean(),
      InventoryUnit.find({ status: "Recalled" }).select("unitCode group recallReason expiresAt").lean(),
      BloodRequest.find({ status: { $ne: "Fulfilled" }, urgency: "High" }).select("group units city state createdAt status").sort({ createdAt: -1 }).limit(100).lean()
    ]);
    res.json({ generatedAt: now, expiring, expired, quarantined, recalled, urgentRequests });
  } catch (err) { console.error("Alert center failed:", err.message); res.status(500).json({ error: "Unable to load alerts." }); }
});
router.post("/alerts/acknowledge", requireAdmin, async (req, res) => {
  try {
    const kind = String(req.body?.kind || "").slice(0, 80), ref = String(req.body?.ref || "").slice(0, 120);
    if (!kind || !ref) return res.status(400).json({ error: "Alert type and reference are required." });
    await audit(req, "alert_acknowledged", ref, { kind });
    res.json({ success: true });
  } catch (err) { console.error("Alert acknowledgement failed:", err.message); res.status(500).json({ error: "Unable to acknowledge alert." }); }
});

// Eligibility review list is a reminder aid only; no message is sent and no donor is declared medically eligible.
router.get("/eligibility-reminders", requireAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const donors = await Donor.find({ verified: true, bloodGroupStatus: "verified", available: true, lastDonation: { $lte: cutoff } })
      .select("name group city state lastDonation totalDonations").sort({ lastDonation: 1 }).limit(500).lean();
    res.json({ generatedAt: new Date(), reminderCandidates: donors.map(d => ({ id: d._id, name: d.name, group: d.group, city: d.city, state: d.state, lastDonation: d.lastDonation, daysSinceDonation: Math.floor((Date.now() - new Date(d.lastDonation).getTime()) / 86400000), totalDonations: d.totalDonations, note: "Reminder candidate only; eligibility must be confirmed by qualified staff." })) });
  } catch (err) { console.error("Eligibility reminders failed:", err.message); res.status(500).json({ error: "Unable to load reminder candidates." }); }
});

// Downloadable aggregate analytics; intentionally excludes personal data.
router.get("/reports", requireAdmin, async (req, res) => {
  try {
    const [requestCounts, inventoryCounts, donorCounts, appointmentCounts] = await Promise.all([
      BloodRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, units: { $sum: "$units" } } }]),
      InventoryUnit.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Donor.aggregate([{ $group: { _id: "$bloodGroupStatus", count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);
    res.json({ generatedAt: new Date(), requestCounts, inventoryCounts, donorCounts, appointmentCounts });
  } catch (err) { console.error("Reports failed:", err.message); res.status(500).json({ error: "Unable to generate reports." }); }
});
module.exports = router;
