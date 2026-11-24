function validCoordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return false;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function validPoint(point) {
  return Boolean(point &&
    validCoordinate(point.lat, -90, 90) &&
    validCoordinate(point.lng, -180, 180));
}

function isUnitSafeForUse(unit, now = new Date()) {
  if (!unit || unit.testStatus !== "Passed") return false;
  const expiry = unit.expiresAt instanceof Date ? unit.expiresAt : new Date(unit.expiresAt);
  return Number.isFinite(expiry.getTime()) &&
    expiry > now &&
    ["Available", "Reserved"].includes(unit.status);
}

function requiresQuarantineReleaseReason(unit, nextStatus, reason) {
  return Boolean(nextStatus === "Available" && unit && unit.status === "Quarantined" &&
    String(unit.recallReason || "").trim() && !(typeof reason === "string" && reason.trim()));
}

function canReleaseAfterScreening(unit, testStatus, now = new Date()) {
  if (!unit || testStatus !== "Passed") return false;
  const expiry = unit.expiresAt instanceof Date ? unit.expiresAt : new Date(unit.expiresAt);
  const manuallyQuarantined = unit.status === "Quarantined" && Boolean(String(unit.recallReason || "").trim());
  return Number.isFinite(expiry.getTime()) && expiry > now && !manuallyQuarantined;
}

module.exports = { validCoordinate, validPoint, isUnitSafeForUse, canReleaseAfterScreening, requiresQuarantineReleaseReason };
