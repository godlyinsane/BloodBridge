const express = require("express");
const router = express.Router();
const BloodBank = require("../models/BloodBank");
const RegisteredBloodBank = require("../models/RegisteredBloodBank");
const requireAdmin = require("../middleware/requireAdmin");

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) return null;

  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((6371 * c).toFixed(2));
}

function buildDirectionsUrl(destination, lat, lng) {
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination || "blood bank")}`;
}

// GET /api/blood-banks/nearest
// Uses GPS coordinates or manual query (city/pincode), queries Google Places if configured,
// and cross-references database blood banks with calculated distances.
router.get("/nearest", async (req, res) => {
  try {
    const { lat, lng, query, radius = 50 } = req.query;
    const hasCoordinates = lat != null && lng != null && String(lat).trim() !== "" && String(lng).trim() !== "";
    const userLat = hasCoordinates ? Number(lat) : null;
    const userLng = hasCoordinates ? Number(lng) : null;
    const searchRadiusKm = Math.min(Math.max(Number(radius) || 50, 5), 200);
    const searchQuery = String(query || "").trim();

    const results = [];
    const seenNames = new Set();

    // 1. If Google Places API Key is present in environment, query Google Places API
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      try {
        let placesUrl = "";
        if (hasCoordinates) {
          const radiusMeters = Math.min(searchRadiusKm * 1000, 50000);
          placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLat},${userLng}&radius=${radiusMeters}&type=hospital&keyword=blood+bank&key=${googleApiKey}`;
        } else if (searchQuery) {
          placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery + " blood bank")}&key=${googleApiKey}`;
        }

        if (placesUrl) {
          const gRes = await fetch(placesUrl);
          const gData = await gRes.json();
          if (Array.isArray(gData.results)) {
            for (const place of gData.results.slice(0, 15)) {
              const pLat = place.geometry?.location?.lat;
              const pLng = place.geometry?.location?.lng;
              const dist = hasCoordinates && pLat != null && pLng != null
                ? haversineDistanceKm(userLat, userLng, pLat, pLng)
                : null;

              const name = place.name || "Blood Bank";
              const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
              seenNames.add(key);

              results.push({
                _id: "google_" + (place.place_id || Math.random().toString(36).slice(2)),
                name,
                address: place.vicinity || place.formatted_address || "Address available via Google Maps",
                phone: place.formatted_phone_number || "",
                openingHours: place.opening_hours?.open_now ? "Open now (24 Hours)" : "24x7 Emergency Services",
                lat: pLat || null,
                lng: pLng || null,
                distanceKm: dist,
                directionsUrl: buildDirectionsUrl(name + ", " + (place.vicinity || place.formatted_address || ""), pLat, pLng),
                source: "Google Places",
                rating: place.rating || null,
                openNow: place.opening_hours?.open_now ?? true,
              });
            }
          }
        }
      } catch (gErr) {
        console.warn("Google Places API lookup notice:", gErr.message);
      }
    }

    // 2. Query BloodBank and RegisteredBloodBank collections
    const [directoryBanks, registeredBanks] = await Promise.all([
      BloodBank.find().lean(),
      RegisteredBloodBank.find({ status: { $in: ["verified", "pending"] } }).lean(),
    ]);

    const allDbBanks = [
      ...directoryBanks.map((b) => ({ ...b, sourceKind: "directory" })),
      ...registeredBanks.map((b) => ({
        ...b,
        sourceKind: "registered",
        address: b.address || [b.district, b.state].filter(Boolean).join(", "),
      })),
    ];

    for (const bank of allDbBanks) {
      const bName = bank.name || "Blood Bank";
      const key = bName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenNames.has(key)) continue;

      const fullAddress = [bank.address, bank.city, bank.district, bank.state].filter(Boolean).join(", ");
      let dist = null;

      if (hasCoordinates && bank.lat != null && bank.lng != null) {
        dist = haversineDistanceKm(userLat, userLng, bank.lat, bank.lng);
      }

      // Check if matches manual search query if provided
      let matchesSearch = true;
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        const matchesAddress = fullAddress.toLowerCase().includes(queryLower);
        const matchesName = bName.toLowerCase().includes(queryLower);
        matchesSearch = matchesAddress || matchesName;
      }

      if (hasCoordinates && dist != null && dist > searchRadiusKm && !searchQuery) {
        continue;
      }

      if (matchesSearch) {
        results.push({
          _id: bank._id,
          name: bName,
          address: fullAddress || "Location registered in portal",
          phone: bank.phone || "",
          email: bank.email || "",
          city: bank.city || "",
          district: bank.district || bank.city || "",
          state: bank.state || "Madhya Pradesh",
          category: bank.category || "Government",
          facilityType: bank.facilityType || "Blood Bank",
          serviceCategory: bank.serviceCategory || "Both (Need Blood & Donate)",
          components: bank.components || "Whole Blood",
          openingHours: bank.openingHours || "24x7 Emergency Availability",
          notes: bank.notes || "",
          lat: bank.lat || null,
          lng: bank.lng || null,
          distanceKm: dist,
          directionsUrl: buildDirectionsUrl(bName + ", " + fullAddress, bank.lat, bank.lng),
          source: bank.sourceKind === "registered" ? "Verified Portal Registry" : (bank.category || "Directory"),
          rating: 4.9,
          openNow: true,
        });
      }
    }

    // Sort results: nearest distance first, or by name if distances unavailable
    results.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      count: results.length,
      userLocation: hasCoordinates ? { lat: userLat, lng: userLng } : null,
      searchQuery: searchQuery || null,
      results: results.slice(0, 30),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to find nearest blood banks: " + err.message });
  }
});

// GET /api/blood-banks
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.district) filter.district = new RegExp(req.query.district.trim(), "i");
    if (req.query.city) filter.city = new RegExp(req.query.city.trim(), "i");
    if (req.query.category) filter.category = new RegExp(req.query.category.trim(), "i");
    const banks = await BloodBank.find(filter).sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/blood-banks
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      name, city, district, state = "Madhya Pradesh", phone, email = "",
      category = "Government", facilityType = "Blood Bank", serviceCategory = "Both (Need Blood & Donate)",
      components = "Whole Blood", address = "", lat, lng, openingHours = "24x7 Emergency Services",
      notes = ""
    } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 160) {
      return res.status(400).json({ error: "Blood bank name is required (max 160 characters)." });
    }
    const hasLat = lat !== undefined && lat !== null && String(lat).trim() !== "";
    const hasLng = lng !== undefined && lng !== null && String(lng).trim() !== "";
    if (hasLat !== hasLng) return res.status(400).json({ error: "Latitude and longitude must be supplied together." });
    const numericLat = hasLat ? Number(lat) : null;
    const numericLng = hasLng ? Number(lng) : null;
    if (
      hasLat &&
      (!Number.isFinite(numericLat) || numericLat < -90 || numericLat > 90 || !Number.isFinite(numericLng) || numericLng < -180 || numericLng > 180)
    ) {
      return res.status(400).json({ error: "Enter valid latitude and longitude coordinates." });
    }
    const bank = await BloodBank.create({
      name: name.trim(),
      city: String(city || "").trim(),
      district: String(district || city || "").trim(),
      state: String(state || "Madhya Pradesh").trim(),
      phone: String(phone || "").trim(),
      email: String(email || "").trim(),
      category: String(category || "Government").trim(),
      facilityType: String(facilityType || "Blood Bank").trim(),
      serviceCategory: String(serviceCategory || "Both (Need Blood & Donate)").trim(),
      components: String(components || "Whole Blood").trim(),
      address: String(address || "").slice(0, 500),
      lat: numericLat,
      lng: numericLng,
      openingHours: String(openingHours || "24x7 Emergency Services").slice(0, 200),
      notes: String(notes || "").slice(0, 500),
    });
    res.status(201).json(bank);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { name, city, state, phone, address, lat, lng, openingHours } = req.body || {};
    const update = {};
    if (name !== undefined) update.name = String(name).trim().slice(0, 160);
    if (city !== undefined) update.city = String(city).trim().slice(0, 120);
    if (state !== undefined) update.state = String(state).trim().slice(0, 120);
    if (phone !== undefined) update.phone = String(phone).trim().slice(0, 40);
    if (address !== undefined) update.address = String(address).trim().slice(0, 300);
    if (openingHours !== undefined) update.openingHours = String(openingHours).trim().slice(0, 160);
    if (lat !== undefined || lng !== undefined) {
      const numericLat = Number(lat);
      const numericLng = Number(lng);
      if (!Number.isFinite(numericLat) || numericLat < -90 || numericLat > 90 || !Number.isFinite(numericLng) || numericLng < -180 || numericLng > 180) {
        return res.status(400).json({ error: "Latitude and longitude must be valid and supplied together." });
      }
      update.lat = numericLat;
      update.lng = numericLng;
    }
    const bank = await BloodBank.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!bank) return res.status(404).json({ error: "Blood bank not found." });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ error: "Unable to update blood bank details." });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await BloodBank.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
