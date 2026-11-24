const test = require("node:test");
const assert = require("node:assert/strict");
const AppointmentRateLimit = require("../models/AppointmentRateLimit");

test("appointment rate-limit model has a unique per-client window and TTL cleanup", () => {
  const indexes = AppointmentRateLimit.schema.indexes();
  assert.ok(indexes.some(([fields, options]) =>
    fields.fingerprint === 1 && fields.windowStart === 1 && options.unique === true
  ));
  assert.ok(indexes.some(([fields, options]) =>
    fields.expiresAt === 1 && options.expireAfterSeconds === 0
  ));
  assert.equal(AppointmentRateLimit.schema.path("count").options.default, 0);
});
