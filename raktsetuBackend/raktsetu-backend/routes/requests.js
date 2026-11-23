const express = require("express");
const router = express.Router();
const BloodRequest = require("../models/BloodRequest");
const Donor = require("../models/Donor");
const Donation = require("../models/Donation");
const { haversineKm, isEligibleToDonate } = require("../utils/matching");
const requireAdmin = require("../middleware/requireAdmin");
const requireRequester = require("../middleware/requireRequester");

const BLOOD_GROUPS = new Set(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]);
const URGENCIES = new Set(["Normal", "High"]);

function validCoordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return false;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

// Public request board intentionally omits recipient names and exact coordinates.
router.get("/public", async (req, res) => {
  try {
    const requests = await BloodRequest.find({ status: { $ne: "Fulfilled" } })
      .select("requesterId requesterName requesterPhone recipient group units urgency district city state status createdAt")
      .sort({ createdAt: -1 }).limit(200).lean();
    res.json(requests);
  } catch (err) {
    console.error("Failed to list public blood requests:", err.message);
    res.status(500).json({ error: "Unable to load blood requests." });
  }
});


// Requester dashboard: only the authenticated account can see its own full request history.
router.get("/mine", requireRequester, async (req, res) => {
  try {
    const requests = await BloodRequest.find({ requesterId: req.requester.id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(requests);
  } catch (err) {
    console.error("Failed to list requester requests:", err.message);
    res.status(500).json({ error: "Unable to load your request dashboard." });
  }
});

// Full requests, including recipient and precise location, are admin-only.
router.get("/", requireAdmin, async (req, res) => {
  try {
    const requests = await BloodRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error("Failed to list blood requests:", err.message);
    res.status(500).json({ error: "Unable to load blood requests." });
  }
});

// POST /api/requests { recipient, group, units, urgency, lat, lng, city, state }
// Only donors whose account AND blood-group document have been verified are
// returned as matches. Phone OTP verification alone does not verify blood group.
router.post("/", requireRequester, async (req, res) => {
  try {
    const { recipient, group, units = 1, urgency = "Normal", lat, lng, district, city, state } = req.body || {};
    const cleanDistrict = String(district || city || "").trim();
    const cleanRecipient = typeof recipient === "string" ? recipient.trim() : "";
    const requester = await require("../models/Requester").findById(req.requester.id);
    if (!requester) return res.status(401).json({ error: "Requester account not found. Please log in again." });
    const numericLat = typeof lat === "number" ? lat : Number(lat);
    const numericLng = typeof lng === "number" ? lng : Number(lng);
    const numericUnits = typeof units === "number" ? units : Number(units);

    if (!cleanRecipient || cleanRecipient.length > 120) {
      return res.status(400).json({ error: "Recipient name is required and must be 120 characters or fewer." });
    }
    if (!BLOOD_GROUPS.has(group)) {
      return res.status(400).json({ error: "Please select a valid standard blood group." });
    }
    if (!Number.isInteger(numericUnits) || numericUnits < 1 || numericUnits > 20) {
      return res.status(400).json({ error: "Units must be a whole number between 1 and 20." });
    }
    if (!URGENCIES.has(urgency)) {
      return res.status(400).json({ error: "Urgency must be Normal or High." });
    }
    if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
      return res.status(400).json({ error: "A valid recipient latitude and longitude are required." });
    }

    const radiusKm = urgency === "High" ? 25 : 10;
    // Start with phone-verified, available donors of the requested group so the UI
    // can explain why a donor is not matchable, without exposing donor identities.
    const sameGroupDonors = await Donor.find({
      verified: true,
      available: true,
      group,
    }).select("name phone group gender lat lng city state district lastDonation bloodGroupStatus");

    const candidates = sameGroupDonors.filter((donor) => donor.bloodGroupStatus === "verified");
    const unverifiedBloodGroupCount = sameGroupDonors.length - candidates.length;

    // Rank eligible donors by distance; this project version does not use a separate consent vault.
    const locationEligible = candidates.filter((d) =>
      validCoordinate(d.lat, -90, 90) && validCoordinate(d.lng, -180, 180)
    );
    const donationIntervalBlocked = locationEligible.filter((d) => !isEligibleToDonate(d.gender, d.lastDonation)).length;
    const ranked = locationEligible
      .filter((d) => isEligibleToDonate(d.gender, d.lastDonation))
      .map((d) => {
        const distanceKm = haversineKm(numericLat, numericLng, d.lat, d.lng);
        return {
          _id: d._id,
          name: d.name,
          phone: d.phone,
          group: d.group,
          district: d.district || d.city || "",
          city: d.district || d.city || "",
          state: d.state || "",
          district: d.district || "",
          bloodGroupStatus: d.bloodGroupStatus,
          distanceKm,
          lat: Math.round(Number(d.lat) * 100) / 100,
          lng: Math.round(Number(d.lng) * 100) / 100,
          lastDonation: d.lastDonation,
        };
      })
      .filter((d) => Number.isFinite(d.distanceKm) && d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const diagnostics = {
      sameGroupAvailable: sameGroupDonors.length,
      bloodGroupVerificationNeeded: unverifiedBloodGroupCount,
      donationIntervalBlocked,
      verifiedSameGroup: candidates.length,
      radiusKm,
    };

    const request = new BloodRequest({
      requesterId: requester._id,
      requesterName: requester.name,
      requesterPhone: requester.phone,
      recipient: cleanRecipient,
      group,
      units: numericUnits,
      urgency,
      lat: numericLat,
      lng: numericLng,
      district: cleanDistrict.slice(0, 100),
      city: cleanDistrict.slice(0, 100),
      state: typeof state === "string" ? state.trim().slice(0, 100) : "",
      status: ranked.length ? "Matched" : "Open",
      matchedDonorIds: ranked.map((d) => d._id),
    });
    await request.save();

    res.status(201).json({ request, matches: ranked, diagnostics });
  } catch (err) {
    console.error("Failed to create blood request:", err.message);
    res.status(500).json({ error: "Unable to create blood request right now." });
  }
});


// A requester can only mark their own request as fulfilled after coordination is complete.
router.patch("/mine/:id/fulfill", requireRequester, async (req, res, next) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid request ID." });
    const request = await BloodRequest.findOne({ _id: req.params.id, requesterId: req.requester.id });
    if (!request) return res.status(404).json({ error: "Request not found in your account." });
    if (request.status === "Fulfilled") return res.status(409).json({ error: "This request is already marked fulfilled." });
    request.status = "Fulfilled";
    request.statusHistory.push({ status: "Fulfilled", note: "Marked fulfilled by requester", changedBy: String(req.requester.id) });
    await request.save();
    res.json(request);
  } catch (err) { next(err); }
});

// PATCH /api/requests/:id/fulfill { donorId } (admin only)
router.patch("/:id/fulfill", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid request ID." });
    }
    const request = await BloodRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.status === "Fulfilled") {
      return res.status(409).json({ error: "This request has already been fulfilled." });
    }

    const { donorId } = req.body || {};
    if (donorId && !/^[a-f\d]{24}$/i.test(donorId)) {
      return res.status(400).json({ error: "Invalid donor ID." });
    }

    if (donorId) {
      const donor = await Donor.findOne({
        _id: donorId,
        verified: true,
        bloodGroupStatus: "verified",
        available: true,
        group: request.group,
      });
      if (!donor) {
        return res.status(400).json({ error: "The selected donor is not currently verified, available, or a matching blood group." });
      }
      if (!isEligibleToDonate(donor.gender, donor.lastDonation)) {
        return res.status(400).json({ error: "The selected donor does not meet the app's preliminary donation interval check. Confirm eligibility with qualified donation-centre staff." });
      }
      await Donation.create({ donorId, requestId: request._id, donationDate: new Date() });
      donor.lastDonation = new Date();
      donor.totalDonations = (donor.totalDonations || 0) + 1;
      donor.available = false;
      await donor.save();
    }

    request.status = "Fulfilled";
    await request.save();
    res.json(request);
  } catch (err) {
    console.error("Failed to fulfill blood request:", err.message);
    res.status(500).json({ error: "Unable to fulfill blood request right now." });
  }
});

module.exports = router;
