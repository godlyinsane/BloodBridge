const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validCoordinate,
  validPoint,
  isUnitSafeForUse,
  canReleaseAfterScreening,
  requiresQuarantineReleaseReason,
} = require("../utils/advancedPolicy");

const now = new Date("2026-10-24T12:00:00.000Z");
const future = new Date("2026-11-01T00:00:00.000Z");
const past = new Date("2026-10-01T00:00:00.000Z");

test("coordinate validation accepts valid boundaries and numeric strings", () => {
  assert.equal(validCoordinate(-90, -90, 90), true);
  assert.equal(validCoordinate("180", -180, 180), true);
  assert.equal(validPoint({ lat: "22.7", lng: "75.8" }), true);
});

test("coordinate validation rejects blank, non-finite and out-of-range values", () => {
  assert.equal(validCoordinate("", -90, 90), false);
  assert.equal(validCoordinate("   ", -90, 90), false);
  assert.equal(validCoordinate("NaN", -90, 90), false);
  assert.equal(validCoordinate(90.01, -90, 90), false);
  assert.equal(validPoint({ lat: 91, lng: 0 }), false);
  assert.equal(validPoint({ lat: 0, lng: null }), false);
});

test("only passed, unexpired available or reserved units are safe for use", () => {
  assert.equal(isUnitSafeForUse({ status: "Available", testStatus: "Passed", expiresAt: future }, now), true);
  assert.equal(isUnitSafeForUse({ status: "Reserved", testStatus: "Passed", expiresAt: future }, now), true);
  assert.equal(isUnitSafeForUse({ status: "Available", testStatus: "Failed", expiresAt: future }, now), false);
  assert.equal(isUnitSafeForUse({ status: "Available", testStatus: "Passed", expiresAt: past }, now), false);
  assert.equal(isUnitSafeForUse({ status: "Quarantined", testStatus: "Passed", expiresAt: future }, now), false);
  assert.equal(isUnitSafeForUse({ status: "Issued", testStatus: "Passed", expiresAt: future }, now), false);
});

test("screening cannot release pending, failed, expired or manually quarantined units", () => {
  const ordinary = { status: "Quarantined", recallReason: "", expiresAt: future };
  assert.equal(canReleaseAfterScreening(ordinary, "Pending", now), false);
  assert.equal(canReleaseAfterScreening(ordinary, "Failed", now), false);
  assert.equal(canReleaseAfterScreening({ ...ordinary, expiresAt: past }, "Passed", now), false);
  assert.equal(canReleaseAfterScreening({ ...ordinary, recallReason: "Safety hold" }, "Passed", now), false);
  assert.equal(canReleaseAfterScreening(ordinary, "Passed", now), true);
});

test("invalid expiry dates fail closed", () => {
  assert.equal(isUnitSafeForUse({ status: "Available", testStatus: "Passed", expiresAt: "not-a-date" }, now), false);
  assert.equal(canReleaseAfterScreening({ status: "Quarantined", expiresAt: "not-a-date" }, "Passed", now), false);
});

test("manual quarantine release requires an explicit reason", () => {
  const held = { status: "Quarantined", recallReason: "Safety hold" };
  assert.equal(requiresQuarantineReleaseReason(held, "Available", ""), true);
  assert.equal(requiresQuarantineReleaseReason(held, "Available", "Reviewed and cleared"), false);
  assert.equal(requiresQuarantineReleaseReason({ ...held, recallReason: "" }, "Available", ""), false);
  assert.equal(requiresQuarantineReleaseReason(held, "Discarded", ""), false);
});
