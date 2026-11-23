const test = require("node:test");
const assert = require("node:assert/strict");

test("phone number sanitization and privacy masking", () => {
  const sanitizePhone = (val) => String(val || "").replace(/\D/g, "").slice(-10);
  const maskPhone = (phone) => {
    const clean = sanitizePhone(phone);
    if (clean.length === 10) {
      return clean.slice(0, 2) + "xxxxxx" + clean.slice(-2);
    }
    return "xxxxxxxxxx";
  };

  const raw = "+91 9876543210";
  const sanitized = sanitizePhone(raw);
  assert.equal(sanitized, "9876543210");
  assert.equal(maskPhone(sanitized), "98xxxxxx10");
});

test("blood group validation allows only recognized ABO and Rh types", () => {
  const ALLOWED_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  assert.equal(ALLOWED_GROUPS.includes("O+"), true);
  assert.equal(ALLOWED_GROUPS.includes("AB-"), true);
  assert.equal(ALLOWED_GROUPS.includes("C+"), false);
  assert.equal(ALLOWED_GROUPS.includes(""), false);
});

test("haversine distance calculates accurate geographic separation", () => {
  function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const toRad = (x) => (Number(x) * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return Number((6371 * c).toFixed(2));
  }

  // Same coordinates should have 0 distance
  assert.equal(haversineDistanceKm(22.0797, 82.1409, 22.0797, 82.1409), 0);

  // Known points: Bilaspur (22.0797, 82.1409) to Raipur (21.2514, 81.6296) ~ 105-115 km
  const dist = haversineDistanceKm(22.0797, 82.1409, 21.2514, 81.6296);
  assert.ok(dist > 100 && dist < 125, `Distance was ${dist}`);
});

test("sorting listings by newest first places higher timestamp first", () => {
  const listings = [
    { id: 1, name: "Donor xx", createdAt: new Date("2026-11-15") },
    { id: 2, name: "Donor xx", createdAt: new Date("2026-11-17") },
    { id: 3, name: "Donor xx", createdAt: new Date("2026-11-16") },
  ];

  listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  assert.equal(listings[0].id, 2);
  assert.equal(listings[1].id, 3);
  assert.equal(listings[2].id, 1);
});
