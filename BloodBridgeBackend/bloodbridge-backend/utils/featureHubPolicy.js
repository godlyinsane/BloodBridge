const crypto = require("crypto");
const GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

function appointmentRateLimitFingerprint(address, secret) {
  return crypto.createHmac("sha256", String(secret || "bloodbridge-rate-limit-fallback"))
    .update(String(address || "unknown").slice(0, 100))
    .digest("hex");
}

function isValidPoint(point) {
  if (!point || point.lat === null || point.lng === null || point.lat === undefined || point.lng === undefined || String(point.lat).trim() === "" || String(point.lng).trim() === "") return false;
  return Number.isFinite(Number(point.lat)) && Number(point.lat) >= -90 && Number(point.lat) <= 90
    && Number.isFinite(Number(point.lng)) && Number(point.lng) >= -180 && Number(point.lng) <= 180;
}

function haversineKm(a, b) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(Number(b.lat) - Number(a.lat));
  const dLng = rad(Number(b.lng) - Number(a.lng));
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(a.lat))) * Math.cos(rad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

function temperatureInRange(temperatureC, minC, maxC) {
  return [temperatureC, minC, maxC].every(Number.isFinite) && minC < maxC && temperatureC >= minC && temperatureC <= maxC;
}

function forecastFromDailyValues(values, horizon = 7) {
  const daily = (Array.isArray(values) ? values : []).map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  });
  const days = Math.max(1, Math.min(30, Math.floor(Number(horizon) || 7)));
  const average = (items) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
  if (!daily.length) {
    return { dailyAverage: 0, trend: 0, projected7DayDemand: 0, trendDirection: "stable", model: "least-squares regression with recent-baseline blend", meanAbsoluteError: 0 };
  }

  // Fit a simple least-squares line to observed daily request units. The model
  // is trained on the actual time series for this blood group; the recent
  // baseline blend reduces sensitivity to a single unusual day.
  const xMean = (daily.length - 1) / 2;
  const yMean = average(daily);
  let numerator = 0, denominator = 0;
  daily.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  const trend = denominator ? numerator / denominator : 0;
  const intercept = yMean - trend * xMean;
  const fitted = daily.map((_, index) => Math.max(0, intercept + trend * index));
  const meanAbsoluteError = average(daily.map((value, index) => Math.abs(value - fitted[index])));
  const recentAverage = average(daily.slice(-Math.min(7, daily.length)));
  const regressionDemand = Array.from({ length: days }, (_, index) => Math.max(0, intercept + trend * (daily.length + index))).reduce((sum, value) => sum + value, 0);
  const projected = regressionDemand * 0.7 + recentAverage * days * 0.3;
  const dailyAverage = yMean;
  const directionThreshold = Math.max(0.1, dailyAverage * 0.02);

  return {
    dailyAverage,
    trend: Math.round(trend * 1000) / 1000,
    projected7DayDemand: Math.max(0, Math.ceil(projected)),
    trendDirection: trend > directionThreshold ? "rising" : trend < -directionThreshold ? "falling" : "stable",
    model: "least-squares regression with recent-baseline blend",
    meanAbsoluteError: Math.round(meanAbsoluteError * 100) / 100
  };
}

function isValidBookingContact(contact) {
  return typeof contact === "string" && /^[+\d][\d\s()+-]{6,24}$/.test(contact);
}

function isValidClientReference(reference) {
  return typeof reference === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(reference);
}

function isValidAppointmentWindow(value, now = new Date(), maxDays = 180) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const nowTimestamp = now instanceof Date ? now.getTime() : Number(now);
  const maxWindow = Math.max(1, Number(maxDays) || 180) * 86400000;
  return Number.isFinite(timestamp) && Number.isFinite(nowTimestamp) && timestamp > nowTimestamp && timestamp <= nowTimestamp + maxWindow;
}

function isTrustedHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch { return false; }
}

function riskPriority(count, totalUnits) {
  if (count >= 6 || totalUnits >= 15) return "High review priority";
  if (count >= 3 || totalUnits >= 8) return "Review";
  return null;
}

module.exports = { GROUPS, isValidPoint, haversineKm, temperatureInRange, forecastFromDailyValues, riskPriority, appointmentRateLimitFingerprint, isValidBookingContact, isValidClientReference, isValidAppointmentWindow, isTrustedHttpsUrl };
