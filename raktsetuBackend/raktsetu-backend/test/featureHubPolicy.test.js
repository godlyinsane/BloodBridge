const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidPoint, haversineKm, temperatureInRange, forecastFromDailyValues, riskPriority, appointmentRateLimitFingerprint, isValidBookingContact, isValidClientReference, isValidAppointmentWindow, isTrustedHttpsUrl } = require("../utils/featureHubPolicy");

test("coordinate validation rejects out-of-range and incomplete points", () => {
  assert.equal(isValidPoint({ lat: 22.08, lng: 82.14 }), true);
  assert.equal(isValidPoint({ lat: 91, lng: 82 }), false);
  assert.equal(isValidPoint({ lat: 22, lng: "" }), false);
  assert.equal(isValidPoint(null), false);
});

test("haversine distance is zero for identical points and positive across cities", () => {
  assert.equal(haversineKm({ lat: 22, lng: 82 }, { lat: 22, lng: 82 }), 0);
  assert.ok(haversineKm({ lat: 22.08, lng: 82.14 }, { lat: 22.1, lng: 82.2 }) > 0);
});

test("cold-chain range check is inclusive and rejects invalid limits", () => {
  assert.equal(temperatureInRange(4, 2, 6), true);
  assert.equal(temperatureInRange(6, 2, 6), true);
  assert.equal(temperatureInRange(7, 2, 6), false);
  assert.equal(temperatureInRange(4, 6, 2), false);
});

test("data-fitted regression forecast responds to rising demand without negative predictions", () => {
  const rising = forecastFromDailyValues([1, 1, 1, 1, 4, 4, 4, 4]);
  assert.equal(rising.trendDirection, "rising");
  assert.equal(rising.model, "least-squares regression with recent-baseline blend");
  assert.ok(rising.projected7DayDemand > 0);
  assert.ok(rising.meanAbsoluteError >= 0);
  assert.equal(forecastFromDailyValues([0, 0, 0, 0]).projected7DayDemand, 0);
});

test("regression forecast recognizes falling demand and clamps negative observations", () => {
  const falling = forecastFromDailyValues([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(falling.trendDirection, "falling");
  assert.ok(forecastFromDailyValues([-4, 0, 0]).projected7DayDemand >= 0);
});

test("empty and malformed forecast samples return finite zero-safe results", () => {
  const empty = forecastFromDailyValues([]);
  const malformed = forecastFromDailyValues([null, "not-a-number", undefined]);
  assert.equal(empty.projected7DayDemand, 0);
  assert.equal(malformed.dailyAverage, 0);
  assert.equal(Number.isFinite(malformed.meanAbsoluteError), true);
});

test("request risk prioritization remains a review hint", () => {
  assert.equal(riskPriority(2, 4), null);
  assert.equal(riskPriority(3, 8), "Review");
  assert.equal(riskPriority(6, 15), "High review priority");
});

test("appointment rate-limit fingerprint is stable without persisting a raw client address", () => {
  const address = "203.0.113.10";
  const first = appointmentRateLimitFingerprint(address, "test-secret");
  assert.equal(first, appointmentRateLimitFingerprint(address, "test-secret"));
  assert.notEqual(first, address);
  assert.notEqual(first, appointmentRateLimitFingerprint(address, "different-secret"));
  assert.equal(first.length, 64);
});

test("appointment booking validation accepts valid contact/reference and rejects invalid dates", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(isValidBookingContact("+91 98765 43210"), true);
  assert.equal(isValidBookingContact("abc"), false);
  assert.equal(isValidClientReference("raktsetu_retry_123456"), true);
  assert.equal(isValidClientReference("bad"), false);
  assert.equal(isValidAppointmentWindow("2026-02-01T00:00:00.000Z", now), true);
  assert.equal(isValidAppointmentWindow("2025-12-31T00:00:00.000Z", now), false);
  assert.equal(isValidAppointmentWindow("not-a-date", now), false);
  assert.equal(isValidAppointmentWindow("2027-01-01T00:00:00.000Z", now), false);
});

test("trusted integration endpoints require clean HTTPS URLs", () => {
  assert.equal(isTrustedHttpsUrl("https://provider.example/api"), true);
  assert.equal(isTrustedHttpsUrl("http://provider.example/api"), false);
  assert.equal(isTrustedHttpsUrl("https://user:password@provider.example/api"), false);
  assert.equal(isTrustedHttpsUrl("not a url"), false);
});
