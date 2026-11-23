const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const router = express.Router();
const requireAdmin = require("../middleware/requireAdmin");
const requireDonor = require("../middleware/requireDonor");
const Donor = require("../models/Donor");
const BloodRequest = require("../models/BloodRequest");
const BloodBank = require("../models/BloodBank");
const InventoryUnit = require("../models/InventoryUnit");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const OperationsAudit = require("../models/OperationsAudit");
const IntegrationKey = require("../models/IntegrationKey");
const AppointmentRateLimit = require("../models/AppointmentRateLimit");
const { GROUPS, isValidPoint, haversineKm, temperatureInRange, forecastFromDailyValues, riskPriority, appointmentRateLimitFingerprint, isValidBookingContact, isValidClientReference, isValidAppointmentWindow, isTrustedHttpsUrl } = require("../utils/featureHubPolicy");
const COMPONENTS = ["WholeBlood", "RedCells", "Platelets", "Plasma", "Cryoprecipitate"];

const safeId = (value) => mongoose.isValidObjectId(value);
const actor = (req) => String(req.admin?.username || req.admin?.id || "admin").slice(0, 160);
const clean = (value, max = 160) => String(value || "").trim().slice(0, max);
async function audit(req, action, resourceType, resourceId, metadata = {}) {
  await OperationsAudit.create({ actor: actor(req), action, resourceType, resourceId: String(resourceId || ""), metadata });
}
async function rateLimitAppointment(req, res, next) {
  // Persist limits in MongoDB so separate Vercel serverless instances cannot
  // bypass a process-local counter. Only a keyed hash of the client address is stored.
  const address = String(req.ip || req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim().slice(0, 100);
  const secret = process.env.JWT_SECRET || "raktsetu-rate-limit-fallback";
  const fingerprint = appointmentRateLimitFingerprint(address, secret);
  const now = Date.now(), windowMs = 10 * 60 * 1000, max = 5;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  try {
    let bucket;
    try {
      bucket = await AppointmentRateLimit.findOneAndUpdate(
        { fingerprint, windowStart },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart.getTime() + 2 * windowMs) } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      // Concurrent first requests may race to create the same unique bucket.
      if (error.code !== 11000) throw error;
      bucket = await AppointmentRateLimit.findOneAndUpdate(
        { fingerprint, windowStart },
        { $inc: { count: 1 } },
        { new: true }
      );
    }
    if (!bucket || bucket.count > max) {
      return res.status(429).json({ error: "Too many booking attempts. Please wait 10 minutes and try again." });
    }
    return next();
  } catch (error) {
    console.error("Appointment rate-limit storage failed:", error.message);
    // Fail closed: public booking is paused rather than silently bypassing abuse protection.
    return res.status(503).json({ error: "Booking protection is temporarily unavailable. Please retry shortly." });
  }
}

async function sendNotificationWebhook(channel, donor, message) {
  const target = process.env.NOTIFICATION_WEBHOOK_URL;
  const token = process.env.NOTIFICATION_WEBHOOK_TOKEN;
  if (!isTrustedHttpsUrl(target) || !token) return { sent: false, reason: "A trusted HTTPS notification webhook and its bearer token must be configured." };
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    // Keep the provider payload minimal; resolve destination addresses in the trusted provider.
    body: JSON.stringify({ project: "RaktSetu", channel, donorId: String(donor._id), message, requestedAt: new Date().toISOString() }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return { sent: false, reason: "Notification provider rejected the request." };
  return { sent: true };
}

// 1. Trend-aware shortage forecast. It is an explainable statistical estimate, not a trained ML model.
router.get("/forecast", requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(14, Number.parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const [requests, stock] = await Promise.all([
      BloodRequest.find({ createdAt: { $gte: since } }).select("group units createdAt status").lean(),
      InventoryUnit.find({ status: "Available", testStatus: "Passed", expiresAt: { $gt: new Date() } }).select("group component expiresAt").lean()
    ]);
    const forecast = GROUPS.map((group) => {
      const rows = requests.filter((r) => r.group === group);
      const daily = Array.from({ length: days }, (_, index) => {
        const start = new Date(Date.now() - (days - index) * 86400000);
        const end = new Date(start.getTime() + 86400000);
        return rows.filter((r) => new Date(r.createdAt) >= start && new Date(r.createdAt) < end)
          .reduce((sum, r) => sum + Math.max(1, Number(r.units) || 1), 0);
      });
      const trendStats = forecastFromDailyValues(daily);
      const { dailyAverage, projected7DayDemand, trendDirection, trend, meanAbsoluteError, model } = trendStats;
      const availableUnits = stock.filter((u) => u.group === group).length;
      const coverageDays = dailyAverage > 0 ? Math.round(availableUnits / dailyAverage * 10) / 10 : null;
      const shortageRisk = availableUnits < projected7DayDemand ? "High" : availableUnits < projected7DayDemand * 1.5 ? "Moderate" : "Lower";
      return { group, historicalUnitsRequested: daily.reduce((a, b) => a + b, 0), availableUnits, projected7DayDemand, trendDirection, trend, meanAbsoluteError, model, coverageDays, shortageRisk, sampleDays: days };
    });
    res.json({ generatedAt: new Date(), method: "least-squares regression fitted to recent request history, blended with a 7-day baseline", disclaimer: "A lightweight data-fitted statistical model, not a large or externally trained AI system. Sparse history, reporting delays and clinical context can change actual demand; use as decision support, not medical advice.", forecast });
  } catch (err) {
    console.error("Feature forecast failed:", err.message);
    res.status(500).json({ error: "Unable to generate the shortage forecast." });
  }
});

// 2. In-app notifications with optional email/push webhooks. SMS is deferred.
router.post("/notifications/send", requireAdmin, async (req, res) => {
  try {
    const donorId = clean(req.body?.donorId, 64);
    const message = clean(req.body?.message, 500);
    const sendEmailToo = req.body?.email === true;
    const sendPushToo = req.body?.push === true;
    if (!safeId(donorId) || message.length < 3) return res.status(400).json({ error: "Choose a valid donor and enter a message." });
    const donor = await Donor.findById(donorId).select("name");
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    const notice = await Notification.create({ donorId: donor._id, message, type: "general" });
    const channels = { inApp: { sent: true } };
    // SMS notifications are intentionally deferred; this route never sends SMS.
    if (req.body?.sms === true) {
      channels.sms = { sent: false, enabled: false, reason: "SMS notifications are planned for a later release." };
    }
    for (const channel of ["email", "push"]) {
      if ((channel === "email" && sendEmailToo) || (channel === "push" && sendPushToo)) {
        try { channels[channel] = await sendNotificationWebhook(channel, donor, message); }
        catch (error) { channels[channel] = { sent: false, reason: "Notification provider could not be reached." }; console.error(channel + " delivery failed:", error.message); }
      }
    }
    await audit(req, "notification.dispatched", "Donor", donor._id, { inApp: true, smsSent: false, emailSent: Boolean(channels.email?.sent), pushSent: Boolean(channels.push?.sent) });
    res.status(201).json({ success: true, inApp: true, channels, notificationId: notice._id });
  } catch (err) { console.error("Notification dispatch failed:", err.message); res.status(500).json({ error: "Unable to send notification." }); }
});

// 3. Safe partner stock import: all imported units begin quarantined until screening is recorded.
router.post("/inventory/import", requireAdmin, async (req, res) => {
  try {
    const rows = req.body?.units;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200) return res.status(400).json({ error: "Provide between 1 and 200 inventory rows." });
    const created = [], errors = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const unitCode = clean(row.unitCode, 80), group = clean(row.group, 8), component = clean(row.component || "WholeBlood", 30);
      const bloodBankId = clean(row.bloodBankId, 64), collectedAt = new Date(row.collectedAt), expiresAt = new Date(row.expiresAt);
      if (!unitCode || !safeId(bloodBankId) || !GROUPS.includes(group) || !COMPONENTS.includes(component) || !Number.isFinite(collectedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || collectedAt > new Date() || expiresAt <= new Date() || expiresAt <= collectedAt) {
        errors.push({ row: i + 1, error: "Invalid unit code, bank, blood group, component or dates." }); continue;
      }
      try {
        if (!(await BloodBank.exists({ _id: bloodBankId }))) { errors.push({ row: i + 1, error: "Blood bank not found." }); continue; }
        const unit = await InventoryUnit.create({ unitCode, bloodBankId, group, component, collectedAt, expiresAt, testStatus: "Pending", status: "Quarantined", notes: "Imported via partner integration; screening required.", createdBy: actor(req), updatedBy: actor(req) });
        created.push({ unitCode: unit.unitCode, status: unit.status });
      } catch (error) {
        errors.push({ row: i + 1, error: error.code === 11000 ? "Duplicate unit code." : "Could not import this row." });
      }
    }
    await audit(req, "inventory.partner_import", "InventoryUnit", "", { accepted: created.length, rejected: errors.length });
    res.status(created.length ? 201 : 400).json({ imported: created.length, rejected: errors.length, created, errors });
  } catch (err) { console.error("Inventory import failed:", err.message); res.status(500).json({ error: "Unable to import partner inventory." }); }
});

// 4. Donor-facing appointment booking, with basic abuse throttling.
router.post("/appointments/book", rateLimitAppointment, async (req, res) => {
  try {
    const donorName = clean(req.body?.donorName, 120), contact = clean(req.body?.contact, 80);
    const bloodBankName = clean(req.body?.bloodBankName, 160), scheduledAt = new Date(req.body?.scheduledAt);
    const notes = clean(req.body?.notes, 300);
    const clientReference = clean(req.body?.clientReference, 80);
    if (!donorName || !bloodBankName || !isValidBookingContact(contact)) return res.status(400).json({ error: "Name, blood bank/camp and a valid contact number are required." });
    if (!isValidClientReference(clientReference)) return res.status(400).json({ error: "A valid booking retry reference is required." });
    const existing = await Appointment.findOne({ clientReference }).lean();
    if (existing) return res.json({ success: true, duplicate: true, reference: String(existing._id).slice(-8).toUpperCase(), appointment: { id: existing._id, donorName: existing.donorName, bloodBankName: existing.bloodBankName, scheduledAt: existing.scheduledAt, status: existing.status }, message: "This booking was already received; no duplicate was created." });
    if (!isValidAppointmentWindow(scheduledAt)) return res.status(400).json({ error: "Choose a time within the next 180 days." });
    // Link the booking to a donor account only when a valid donor token is supplied
    // and the submitted contact matches that account. Anonymous bookings remain unlinked.
    let linkedDonorId = null;
    const authorization = String(req.headers.authorization || "");
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (tokenMatch && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
        if (decoded.role === "donor" && safeId(decoded.id)) {
          const linkedDonor = await Donor.findById(decoded.id).select("_id phone");
          const accountDigits = String(linkedDonor?.phone || "").replace(/\D/g, "");
          const submittedDigits = contact.replace(/\D/g, "");
          if (linkedDonor && accountDigits.length >= 10 && submittedDigits.length >= 10 && accountDigits.slice(-10) === submittedDigits.slice(-10)) {
            linkedDonorId = linkedDonor._id;
          }
        }
      } catch {
        // Invalid/expired optional tokens do not block public bookings.
      }
    }
    let row;
    try {
      row = await Appointment.create({ donorId: linkedDonorId, donorName, contact, bloodBankName, scheduledAt, notes, clientReference, status: "Booked", createdBy: linkedDonorId ? "donor-self-booking" : "public-self-booking" });
    } catch (error) {
      if (error.code === 11000) {
        const duplicate = await Appointment.findOne({ clientReference }).lean();
        if (duplicate) return res.json({ success: true, duplicate: true, reference: String(duplicate._id).slice(-8).toUpperCase(), appointment: { id: duplicate._id, donorName: duplicate.donorName, bloodBankName: duplicate.bloodBankName, scheduledAt: duplicate.scheduledAt, status: duplicate.status }, message: "This booking was already received; no duplicate was created." });
      }
      throw error;
    }
    res.status(201).json({ success: true, reference: String(row._id).slice(-8).toUpperCase(), appointment: { id: row._id, donorName: row.donorName, bloodBankName: row.bloodBankName, scheduledAt: row.scheduledAt, status: row.status }, message: "Booking submitted. The blood bank must confirm the appointment." });
  } catch (err) { console.error("Public appointment booking failed:", err.message); res.status(500).json({ error: "Unable to book the appointment." }); }
});

// 6. Donor profile, history, eligibility reminder and secure digital ID.
router.get("/donor/profile", requireDonor, async (req, res) => {
  try {
    const donor = await Donor.findById(req.donor.id).select("name group city state locality available verified bloodGroupStatus lastDonation totalDonations createdAt");
    if (!donor) return res.status(404).json({ error: "Donor profile not found." });
    const [appointments, notifications] = await Promise.all([
      Appointment.find({ donorId: donor._id }).select("bloodBankName scheduledAt status notes createdAt").sort({ scheduledAt: -1 }).limit(50).lean(),
      Notification.find({ donorId: donor._id }).select("message type read createdAt").sort({ createdAt: -1 }).limit(50).lean()
    ]);
    const daysSinceDonation = donor.lastDonation ? Math.floor((Date.now() - new Date(donor.lastDonation).getTime()) / 86400000) : null;
    res.json({ donor, appointments, notifications, eligibility: { daysSinceDonation, reminderCandidate: daysSinceDonation !== null && daysSinceDonation >= 90, disclaimer: "Reminder candidate only. Donation eligibility must be assessed by qualified blood-bank staff." } });
  } catch (err) { console.error("Donor profile failed:", err.message); res.status(500).json({ error: "Unable to load donor profile." }); }
});
router.get("/donor/digital-id", requireDonor, async (req, res) => {
  try {
    const donor = await Donor.findById(req.donor.id).select("name group city state verified bloodGroupStatus createdAt");
    if (!donor) return res.status(404).json({ error: "Donor profile not found." });
    res.json({ id: "RS-" + crypto.createHash("sha256").update(String(donor._id)).digest("hex").slice(0, 10).toUpperCase(), name: donor.name, bloodGroup: donor.group, city: donor.city, state: donor.state, phoneVerified: donor.verified, bloodGroupVerified: donor.bloodGroupStatus === "verified", issuedAt: donor.createdAt, qrPayload: "raktsetu://donor/" + donor._id, disclaimer: "Digital identification only; not a government ID, medical clearance or guarantee of donor eligibility." });
  } catch (err) { res.status(500).json({ error: "Unable to generate donor ID." }); }
});
router.get("/donor/certificate/:appointmentId", requireDonor, async (req, res) => {
  try {
    if (!safeId(req.params.appointmentId)) return res.status(400).json({ error: "Invalid appointment reference." });
    const donor = await Donor.findById(req.donor.id).select("name phone group");
    const row = await Appointment.findById(req.params.appointmentId).lean();
    if (!donor || !row || row.status !== "Completed" || String(row.donorId || "") !== String(donor._id)) return res.status(404).json({ error: "No completed appointment record linked to this donor account was found." });
    res.json({ certificateId: "RSC-" + crypto.createHash("sha256").update(String(row._id)).digest("hex").slice(0, 12).toUpperCase(), donorName: donor.name, bloodGroup: donor.group, organization: row.bloodBankName, completedAt: row.scheduledAt, issuedAt: new Date(), statement: "This certificate confirms a recorded completed appointment only; it does not replace an official blood-bank certificate." });
  } catch (err) { res.status(500).json({ error: "Unable to issue the certificate record." }); }
});

// 5. Road routing uses OSRM when available, with a clearly labelled straight-line fallback.
router.post("/logistics/route", requireAdmin, async (req, res) => {
  try {
    const points = Array.isArray(req.body?.points) ? req.body.points : [];
    if (points.length < 2 || points.length > 12 || points.some(p => !isValidPoint(p))) return res.status(400).json({ error: "Provide 2–12 valid latitude/longitude points." });
    const coords = points.map(p => Number(p.lng) + "," + Number(p.lat)).join(";");
    try {
      const response = await fetch("https://router.project-osrm.org/trip/v1/driving/" + coords + "?roundtrip=false&source=first&destination=last&overview=false&steps=false", { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Routing provider unavailable.");
      const data = await response.json();
      if (data.code !== "Ok" || !data.trips?.[0]) throw new Error("No road route found.");
      const trip = data.trips[0];
      const waypointOrder = (data.waypoints || []).map((waypoint, inputIndex) => ({ order: waypoint.waypoint_index ?? inputIndex, label: clean(points[inputIndex]?.label || "Stop " + (inputIndex + 1), 100) })).sort((a, b) => a.order - b.order).map((waypoint, index) => ({ index: index + 1, label: waypoint.label }));
      res.json({ source: "OSRM optimized road trip", distanceKm: Math.round(trip.distance / 100) / 10, durationMinutes: Math.ceil(trip.duration / 60), waypointOrder, disclaimer: "Road estimates may not reflect live traffic, closures or emergency vehicle restrictions." });
    } catch {
      const segments = [];
      let total = 0;
      for (let i = 1; i < points.length; i += 1) { const km = haversineKm(points[i - 1], points[i]); total += km; segments.push({ from: i, to: i + 1, distanceKm: Math.round(km * 10) / 10 }); }
      res.json({ source: "Straight-line fallback", distanceKm: Math.round(total * 10) / 10, durationMinutes: Math.ceil(total / 35 * 60), segments, disclaimer: "Routing provider unavailable; straight-line distance and assumed 35 km/h speed are rough estimates, not road navigation or live traffic." });
    }
  } catch (err) { res.status(500).json({ error: "Unable to calculate the emergency route." }); }
});

// 8. Public blood-bank map data excludes donor and patient personal data.
router.get("/map/banks", async (req, res) => {
  try {
    const banks = await BloodBank.find().select("name city state address lat lng latitude longitude phone openingHours").limit(500).lean();
    res.json(banks.map(b => ({ id: b._id, name: b.name, city: b.city, state: b.state, address: b.address || "", lat: Number.isFinite(b.lat) ? b.lat : b.latitude, lng: Number.isFinite(b.lng) ? b.lng : b.longitude, phone: b.phone || "", openingHours: b.openingHours || "" })));
  } catch (err) { res.status(500).json({ error: "Unable to load blood-bank map data." }); }
});

// 9. Explainable request-risk review; flags are for humans and never auto-deny care.
router.get("/risk-review", requireAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 86400000);
    const requests = await BloodRequest.find({ createdAt: { $gte: since }, status: { $ne: "Fulfilled" } }).select("group units city state urgency createdAt status").sort({ createdAt: -1 }).limit(500).lean();
    const groups = new Map();
    for (const r of requests) {
      const key = [r.group, clean(r.city, 80).toLowerCase(), clean(r.state, 80).toLowerCase()].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const flaggedGroups = [];
    for (const [key, rows] of groups) {
      const totalUnits = rows.reduce((sum, r) => sum + Math.max(1, Number(r.units) || 1), 0);
      const priority = riskPriority(rows.length, totalUnits);
      if (priority) flaggedGroups.push({ group: key.split("|")[0], city: key.split("|")[1] || "unspecified", count: rows.length, totalUnits, priority, reason: "Multiple open requests share blood group and locality within seven days. This may reflect genuine demand; review context before action." });
    }
    res.json({ generatedAt: new Date(), flaggedGroups: flaggedGroups.slice(0, 100), disclaimer: "Risk scores are triage hints, not fraud findings. Never automatically deny a request based on this score." });
  } catch (err) { res.status(500).json({ error: "Unable to calculate request-risk indicators." }); }
});

// 10, 11, 15, 16, 17. Language catalog, partner integration readiness, backup trigger and diagnostics.
router.get("/languages", (req, res) => res.json({ default: "en", supported: [{ code: "en", label: "English" }, { code: "hi", label: "हिन्दी" }], note: "The interface currently provides core English/Hindi labels; translated medical/legal text must be reviewed by a qualified translator." }));
router.get("/integration/status", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const activePartnerKeys = await IntegrationKey.countDocuments({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    });
    const notificationWebhookConfigured = Boolean(
      process.env.NOTIFICATION_WEBHOOK_URL
      && isTrustedHttpsUrl(process.env.NOTIFICATION_WEBHOOK_URL)
      && process.env.NOTIFICATION_WEBHOOK_TOKEN
    );
    const backupWebhookConfigured = Boolean(
      process.env.MONGODB_BACKUP_WEBHOOK
      && isTrustedHttpsUrl(process.env.MONGODB_BACKUP_WEBHOOK)
      && process.env.MONGODB_BACKUP_WEBHOOK_TOKEN
    );
    res.json({
      generatedAt: now,
      integrations: [
        { name: "Hospital partner API", configured: activePartnerKeys > 0, activePartnerKeys, detail: activePartnerKeys ? "At least one active, non-expired scoped partner key exists." : "Create and securely distribute a scoped partner API key before a hospital can connect." },
        { name: "SMS notifications", configured: false, detail: "Deferred by design; no SMS is sent by Feature Hub in this release." },
        { name: "Email / push webhook", configured: notificationWebhookConfigured, detail: "Requires a trusted HTTPS provider and bearer token; the provider resolves donorId to an opted-in email address or push subscription. Only donorId and message are sent." },
        { name: "Backup webhook", configured: backupWebhookConfigured, detail: "Requires a trusted HTTPS backup provider and bearer token; trigger acceptance does not by itself prove a recoverable snapshot exists." },
        { name: "Scheduled backup authorization", configured: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32) && backupWebhookConfigured, detail: "Daily Vercel Cron requires CRON_SECRET (32+ characters) and a trusted HTTPS backup webhook." },
        { name: "Road routing", configured: true, detail: "OSRM is attempted with an 8-second timeout; straight-line fallback is explicitly labelled." }
      ],
      security: { jwtSecretConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32), mongoConfigured: Boolean(process.env.MONGO_URI), secretsExposed: false }
    });
  } catch (error) {
    console.error("Integration readiness check failed:", error.message);
    res.status(500).json({ error: "Unable to inspect integration readiness." });
  }
});

router.get("/backup/cron", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET || "";
    const authorization = String(req.headers.authorization || "");
    const supplied = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    const suppliedBuffer = Buffer.from(supplied), secretBuffer = Buffer.from(secret);
    const matches = secretBuffer.length >= 32 && suppliedBuffer.length === secretBuffer.length
      && crypto.timingSafeEqual(suppliedBuffer, secretBuffer);
    if (!matches) return res.status(401).json({ error: "Scheduled job authorization failed." });
    const target = process.env.MONGODB_BACKUP_WEBHOOK;
    if (!isTrustedHttpsUrl(target) || !process.env.MONGODB_BACKUP_WEBHOOK_TOKEN) return res.status(503).json({ error: "Backup webhook URL and bearer token must both be configured." });
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.MONGODB_BACKUP_WEBHOOK_TOKEN ? { Authorization: "Bearer " + process.env.MONGODB_BACKUP_WEBHOOK_TOKEN } : {}) },
      body: JSON.stringify({ project: "RaktSetu", requestedAt: new Date().toISOString(), requestedBy: "vercel-cron", schedule: "daily" }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return res.status(502).json({ error: "Backup provider did not accept the scheduled trigger." });
    await OperationsAudit.create({ actor: "vercel-cron", action: "backup.scheduled_triggered", resourceType: "backup", resourceId: "", metadata: { status: response.status } });
    return res.json({ success: true, message: "Scheduled backup trigger accepted." });
  } catch (err) {
    console.error("Scheduled backup failed:", err.message);
    return res.status(502).json({ error: "Scheduled backup provider could not be reached." });
  }
});

router.post("/backup/trigger", requireAdmin, async (req, res) => {
  try {
    const target = process.env.MONGODB_BACKUP_WEBHOOK;
    if (!isTrustedHttpsUrl(target) || !process.env.MONGODB_BACKUP_WEBHOOK_TOKEN) return res.status(503).json({ error: "Automated backup is not configured. Set MONGODB_BACKUP_WEBHOOK and MONGODB_BACKUP_WEBHOOK_TOKEN for a trusted HTTPS backup service; use your MongoDB provider's managed backups for database snapshots." });
    const response = await fetch(target, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.MONGODB_BACKUP_WEBHOOK_TOKEN ? { Authorization: "Bearer " + process.env.MONGODB_BACKUP_WEBHOOK_TOKEN } : {}) }, body: JSON.stringify({ project: "RaktSetu", requestedAt: new Date().toISOString(), requestedBy: actor(req) }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) return res.status(502).json({ error: "Backup provider did not accept the trigger." });
    await audit(req, "backup.triggered", "backup", "", { status: response.status });
    res.json({ success: true, message: "Backup trigger accepted by configured provider." });
  } catch (err) { res.status(502).json({ error: "Backup provider could not be reached." }); }
});
router.get("/diagnostics", requireAdmin, async (req, res) => res.json({
  generatedAt: new Date(), nodeVersion: process.version, databaseState: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown",
  runtime: process.env.VERCEL === "1" ? "serverless" : "node-server",
  configured: {
    mongo: Boolean(process.env.MONGO_URI),
    jwt: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
    notificationWebhook: Boolean(isTrustedHttpsUrl(process.env.NOTIFICATION_WEBHOOK_URL) && process.env.NOTIFICATION_WEBHOOK_TOKEN),
    backup: Boolean(isTrustedHttpsUrl(process.env.MONGODB_BACKUP_WEBHOOK) && process.env.MONGODB_BACKUP_WEBHOOK_TOKEN),
    cronSecret: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32)
  },
  message: "Diagnostics do not expose secret values or donor/patient personal information."
}));

// 12. Donor retention segments; 90-day candidate list is not medical clearance.
router.get("/retention/candidates", requireAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const rows = await Donor.find({ available: true, verified: true, bloodGroupStatus: "verified", lastDonation: { $lte: cutoff } }).select("name group city lastDonation totalDonations").sort({ lastDonation: 1 }).limit(300).lean();
    res.json(rows.map(d => ({ id: d._id, name: d.name, group: d.group, city: d.city, daysSinceDonation: Math.floor((Date.now() - new Date(d.lastDonation).getTime()) / 86400000), totalDonations: d.totalDonations })));
  } catch (err) { res.status(500).json({ error: "Unable to load donor retention candidates." }); }
});
router.post("/retention/send", requireAdmin, async (req, res) => {
  try {
    const donorId = clean(req.body?.donorId, 64), message = clean(req.body?.message, 500);
    if (!safeId(donorId) || message.length < 3) return res.status(400).json({ error: "Valid donor and message are required." });
    const donor = await Donor.findById(donorId).select("name");
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    await Notification.create({ donorId, message, type: "general" });
    await audit(req, "retention.message_prepared", "Donor", donorId, { inApp: true, smsSent: false });
    res.json({ success: true, inApp: true, sms: { enabled: false, sent: false, reason: "SMS notifications are planned for a later release." } });
  } catch (err) { res.status(500).json({ error: "Unable to send donor-retention message." }); }
});

// 13. Cold-chain logging requires product-specific limits supplied by authorized staff.
router.post("/cold-chain/:unitCode", requireAdmin, async (req, res) => {
  try {
    const unitCode = clean(req.params.unitCode, 80);
    const temperatureC = Number(req.body?.temperatureC), minC = Number(req.body?.minC), maxC = Number(req.body?.maxC);
    if (!unitCode || ![temperatureC, minC, maxC].every(Number.isFinite) || minC >= maxC || temperatureC < -100 || temperatureC > 100) return res.status(400).json({ error: "Provide unit code, temperature and valid product-specific minimum/maximum limits in °C." });
    const unit = await InventoryUnit.findOne({ unitCode });
    if (!unit) return res.status(404).json({ error: "Inventory unit not found." });
    const inRange = temperatureInRange(temperatureC, minC, maxC);
    await audit(req, "cold_chain.temperature_recorded", "InventoryUnit", unit._id, { unitCode, temperatureC, minC, maxC, inRange });
    if (!inRange && !["Issued", "Expired", "Recalled", "Discarded"].includes(unit.status)) {
      unit.status = "Quarantined"; unit.updatedBy = actor(req); unit.notes = (clean(unit.notes, 850) + " | Cold-chain exception: review required.").slice(0, 1000); await unit.save();
      await audit(req, "cold_chain.quarantined", "InventoryUnit", unit._id, { reason: "Temperature outside supplied limits." });
    }
    res.status(201).json({ unitCode, temperatureC, minC, maxC, inRange, action: inRange ? "logged" : "quarantined_for_review", note: "Use the applicable blood-component protocol; this tool does not define clinical temperature limits." });
  } catch (err) { console.error("Cold-chain event failed:", err.message); res.status(500).json({ error: "Unable to record cold-chain event." }); }
});
router.get("/cold-chain", requireAdmin, async (req, res) => {
  try {
    const events = await OperationsAudit.find({ action: { $in: ["cold_chain.temperature_recorded", "cold_chain.quarantined"] } }).sort({ occurredAt: -1 }).limit(200).lean();
    res.json(events);
  } catch (err) { res.status(500).json({ error: "Unable to load cold-chain history." }); }
});

// 14. Aggregate-only analytics; no donor or recipient names in this response.
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const [requests, stock, donors, appointments] = await Promise.all([
      BloodRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, units: { $sum: "$units" } } }]),
      InventoryUnit.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Donor.aggregate([{ $group: { _id: "$bloodGroupStatus", count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);
    const expiringSoon = await InventoryUnit.countDocuments({ status: "Available", expiresAt: { $gt: new Date(), $lte: new Date(Date.now() + 7 * 86400000) } });
    res.json({ generatedAt: new Date(), requests, inventory: stock, donors, appointments, expiringSoon });
  } catch (err) { res.status(500).json({ error: "Unable to generate aggregate analytics." }); }
});

module.exports = router;
