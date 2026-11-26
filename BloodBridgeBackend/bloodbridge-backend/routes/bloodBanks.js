const express = require("express");
const router = express.Router();
const BloodBank = require("../models/BloodBank");

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

    // 2. Query BloodBank collection
    const directoryBanks = await BloodBank.find().lean();
    const allDbBanks = directoryBanks.map((b) => ({ ...b, sourceKind: "directory" }));

    for (const bank of allDbBanks) {
      const bName = bank.name || "Blood Bank";
      const key = bName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenNames.has(key)) continue;

      const fullAddress = [bank.address, bank.city, bank.district, bank.state].filter(Boolean).join(", ");
      let dist = null;

      if (hasCoordinates && bank.lat != null && bank.lng != null) {
        dist = haversineDistanceKm(userLat, userLng, bank.lat, bank.lng);
      }

      if (searchQuery) {
        const matchesQuery = [bName, bank.district, bank.city, bank.state, bank.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        if (!matchesQuery && dist == null) continue;
      }

      seenNames.add(key);
      results.push({
        _id: String(bank._id),
        name: bName,
        address: bank.address || fullAddress || "Address on record",
        phone: bank.phone || "",
        openingHours: bank.openingHours || "24x7 Emergency Services",
        lat: bank.lat || null,
        lng: bank.lng || null,
        distanceKm: dist,
        directionsUrl: buildDirectionsUrl(bName + ", " + (bank.address || fullAddress), bank.lat, bank.lng),
        source: "BloodBridge Network",
        category: bank.category || "Government",
        district: bank.district || bank.city || "",
        state: bank.state || "Madhya Pradesh",
        components: bank.components || "Whole Blood",
        rating: 4.8,
        openNow: true,
      });
    }

    results.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return 0;
    });

    let finalResults = results;
    if (hasCoordinates) {
      const withinRadius = results.filter((r) => r.distanceKm != null && r.distanceKm <= searchRadiusKm);
      if (withinRadius.length > 0) {
        finalResults = withinRadius;
      }
    }

    res.json({
      count: finalResults.length,
      userLocation: hasCoordinates ? { lat: userLat, lng: userLng } : null,
      searchQuery: searchQuery || null,
      results: finalResults.slice(0, 30),
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

module.exports = router;
