const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const router = express.Router();
const requireAdmin = require("../middleware/requireAdmin");
const BloodRequest = require("../models/BloodRequest");
const BloodBank = require("../models/BloodBank");
const InventoryUnit = require("../models/InventoryUnit");
const IntegrationKey = require("../models/IntegrationKey");
const IntegrationRateWindow = require("../models/IntegrationRateWindow");
const OperationsAudit = require("../models/OperationsAudit");
const { validPoint, isUnitSafeForUse, canReleaseAfterScreening, requiresQuarantineReleaseReason } = require("../utils/advancedPolicy");

const GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const COMPONENTS = ["WholeBlood", "RedCells", "Platelets", "Plasma", "Cryoprecipitate"];
const safeId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));
const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");
const actorOf = (req) => String(req.admin?.username || req.admin?.id || "admin").slice(0, 160);

async function audit(actor, action, resourceType, resourceId, metadata = {}) {
  await OperationsAudit.create({ actor, action, resourceType, resourceId: String(resourceId || ""), metadata });
}

// 1) Transparent baseline forecast. It is a planning signal, not a clinical or
// machine-learning prediction; confidence depends on the available historical data.
router.get("/forecast", requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, Number.parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const [requests, stock] = await Promise.all([
      BloodRequest.find({ createdAt: { $gte: since } }).select("group units createdAt status").lean(),
      InventoryUnit.find({ status: "Available", testStatus: "Passed", expiresAt: { $gt: new Date() } }).select("group component expiresAt").lean()
    ]);
    const forecast = GROUPS.map((group) => {
      const demand = requests.filter((r) => r.group === group).reduce((n, r) => n + (Number(r.units) || 1), 0);
      const usable = stock.filter((u) => u.group === group).length;
      const dailyDemand = demand / days;
      const projected7DayDemand = Math.ceil(dailyDemand * 7);
      const coverageDays = dailyDemand > 0 ? Math.round((usable / dailyDemand) * 10) / 10 : null;
      const shortageRisk = usable < projected7DayDemand ? "High" : usable < projected7DayDemand * 1.5 ? "Moderate" : "Lower";
      return { group, historicalUnitsRequested: demand, availableTestPassedUnits: usable, projected7DayDemand, coverageDays, shortageRisk, sampleDays: days };
    });
    res.json({ generatedAt: new Date(), method: "rolling-average baseline", disclaimer: "Planning aid only; incomplete inventory/request data can distort results. Not medical advice or a trained AI model.", forecast });
  } catch (err) {
    console.error("Forecast failed:", err.message);
    res.status(500).json({ error: "Unable to generate shortage forecast." });
  }
});

// 2 & 6) Inventory creation, QR-friendly unit code, traceability and expiry/recall controls.
router.get("/inventory", requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.bloodBankId) {
      if (!safeId(req.query.bloodBankId)) return res.status(400).json({ error: "Invalid blood bank ID." });
      filter.bloodBankId = req.query.bloodBankId;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.group && GROUPS.includes(req.query.group)) filter.group = req.query.group;
    const rows = await InventoryUnit.find(filter).populate("bloodBankId", "name city state").sort({ expiresAt: 1 }).limit(500).lean();
    res.json(rows);
  } catch (err) {
    console.error("Inventory list failed:", err.message);
    res.status(500).json({ error: "Unable to load inventory." });
  }
});

router.post("/inventory", requireAdmin, async (req, res) => {
  try {
    const { unitCode, bloodBankId, group, component, collectedAt, expiresAt, testStatus = "Pending", lastTestedAt, notes = "" } = req.body || {};
    if (typeof unitCode !== "string" || !unitCode.trim() || unitCode.trim().length > 80 || !safeId(bloodBankId) || !GROUPS.includes(group) || !COMPONENTS.includes(component)) {
      return res.status(400).json({ error: "Valid unit code, blood bank, group and component are required." });
    }
    const collected = new Date(collectedAt), expires = new Date(expiresAt), now = new Date();
    if (!Number.isFinite(collected.getTime()) || !Number.isFinite(expires.getTime()) || expires <= collected) return res.status(400).json({ error: "Expiry must be after collection." });
    if (collected > now) return res.status(400).json({ error: "Collection date cannot be in the future." });
    if (expires <= now) return res.status(400).json({ error: "Expired blood units cannot be registered as new inventory." });
    // New inventory must never become usable by supplying testStatus="Passed"
    // in the create payload. A separate audited screening action releases it.
    if (testStatus !== undefined && testStatus !== "Pending") {
      return res.status(400).json({ error: "New units start Pending and Quarantined. Record a screening result separately." });
    }
    if (lastTestedAt && !Number.isFinite(new Date(lastTestedAt).getTime())) return res.status(400).json({ error: "Invalid last-tested date." });
    if (!(await BloodBank.exists({ _id: bloodBankId }))) return res.status(404).json({ error: "Blood bank not found." });
    const unit = await InventoryUnit.create({ unitCode: String(unitCode).trim(), bloodBankId, group, component, collectedAt: collected, expiresAt: expires, testStatus: "Pending", lastTestedAt: null, notes: String(notes).slice(0, 1000), createdBy: actorOf(req), updatedBy: actorOf(req), status: "Quarantined" });
    await audit(actorOf(req), "inventory.created", "InventoryUnit", unit._id, { group, component });
    res.status(201).json({ unit, traceabilityUrl: "/api/advanced/trace/" + encodeURIComponent(unit.unitCode) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Unit code already exists." });
    console.error("Inventory create failed:", err.message);
    res.status(500).json({ error: "Unable to create inventory unit." });
  }
});

router.get("/trace/:unitCode", requireAdmin, async (req, res) => {
  try {
    const unit = await InventoryUnit.findOne({ unitCode: req.params.unitCode }).populate("bloodBankId", "name city state").lean();
    if (!unit) return res.status(404).json({ error: "Unit not found." });
    const history = await OperationsAudit.find({ resourceType: "InventoryUnit", resourceId: String(unit._id) }).sort({ occurredAt: 1 }).lean();
    res.json({ unit, history });
  } catch (err) { res.status(500).json({ error: "Unable to load traceability record." }); }
});

// Authorized screening-result workflow: units start quarantined and can only
// enter usable inventory after an explicit Passed result is recorded.
router.patch("/inventory/:id/testing", requireAdmin, async (req, res) => {
  try {
    if (!safeId(req.params.id)) return res.status(400).json({ error: "Invalid inventory ID." });
    const { testStatus } = req.body || {};
    if (!["Pending", "Passed", "Failed"].includes(testStatus)) {
      return res.status(400).json({ error: "Screening result must be Pending, Passed, or Failed." });
    }
    const unit = await InventoryUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: "Inventory unit not found." });
    if (["Issued", "Expired", "Recalled", "Discarded"].includes(unit.status)) {
      return res.status(409).json({ error: "Screening cannot change the state of an issued, expired, recalled, or discarded unit." });
    }
    unit.testStatus = testStatus;
    unit.lastTestedAt = testStatus === "Pending" ? null : new Date();
    // Failed or pending screening always keeps the unit out of usable stock.
    // A manual quarantine carries a reason. A passing test alone must not
    // silently release a unit held for another safety concern; release it
    // explicitly through the audited status workflow after review.
    unit.status = canReleaseAfterScreening(unit, testStatus, new Date())
      ? "Available"
      : "Quarantined";
    unit.updatedBy = actorOf(req);
    await unit.save();
    await audit(actorOf(req), "inventory.screening_recorded", "InventoryUnit", unit._id, {
      testStatus, status: unit.status
    });
    res.json(unit);
  } catch (err) {
    console.error("Inventory screening update failed:", err.message);
    res.status(500).json({ error: "Unable to record screening result." });
  }
});

router.patch("/inventory/:id/status", requireAdmin, async (req, res) => {
  try {
    if (!safeId(req.params.id)) return res.status(400).json({ error: "Invalid inventory ID." });
    const { status, reason = "" } = req.body || {};
    const allowed = ["Available", "Reserved", "Issued", "Quarantined", "Recalled", "Expired", "Discarded"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid inventory status." });
    const unit = await InventoryUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: "Inventory unit not found." });
    const now = new Date();
    if (unit.status === "Recalled" && status !== "Discarded") return res.status(409).json({ error: "Recalled units cannot be released or reused; discard them through the authorized process." });
    if (unit.status === "Discarded") return res.status(409).json({ error: "Discarded units cannot be reactivated." });
    if (unit.status === "Issued" && !["Recalled", "Discarded"].includes(status)) return res.status(409).json({ error: "Issued units cannot return to usable inventory." });
    if (unit.status === "Expired" && !["Recalled", "Discarded"].includes(status)) return res.status(409).json({ error: "Expired units cannot return to usable inventory." });
    if (status === "Available" && (unit.testStatus !== "Passed" || unit.expiresAt <= now)) return res.status(409).json({ error: "Only unexpired units with passed testing can be marked available." });
    if (requiresQuarantineReleaseReason(unit, status, reason)) return res.status(400).json({ error: "A reason is required to release a manually quarantined unit." });
    // Status can become stale when a unit passes its expiry time. Recheck
    // screening and expiry at the point of reservation/issue, not just when
    // it was originally marked Available.
    if (status === "Reserved" && (!isUnitSafeForUse(unit, now) || unit.status !== "Available")) {
      return res.status(409).json({ error: "Only available, unexpired units with passed testing can be reserved." });
    }
    if (status === "Issued" && !isUnitSafeForUse(unit, now)) {
      return res.status(409).json({ error: "Only available or reserved, unexpired units with passed testing can be issued." });
    }
    if (status === "Expired" && unit.expiresAt > now) return res.status(409).json({ error: "A unit cannot be marked expired before its expiry date." });
    if (["Recalled", "Quarantined", "Discarded"].includes(status) && (typeof reason !== "string" || !reason.trim())) return res.status(400).json({ error: "A reason is required for recall, quarantine, or discard." });
    unit.status = status;
    if (status === "Recalled" || status === "Quarantined") unit.recallReason = String(reason).trim().slice(0, 500);
    unit.updatedBy = actorOf(req);
    await unit.save();
    await audit(actorOf(req), "inventory.status_changed", "InventoryUnit", unit._id, { status, reason: String(reason).slice(0, 300) });
    res.json(unit);
  } catch (err) { res.status(500).json({ error: "Unable to update inventory status." }); }
});

router.get("/inventory/alerts", requireAdmin, async (req, res) => {
  try {
    const now = new Date(), soon = new Date(Date.now() + 7 * 86400000);
    const [expiring, expired, recalled] = await Promise.all([
      InventoryUnit.find({ status: { $in: ["Available", "Reserved"] }, expiresAt: { $gt: now, $lte: soon } }).populate("bloodBankId", "name city").limit(500).lean(),
      InventoryUnit.find({ status: { $ne: "Expired" }, expiresAt: { $lte: now } }).populate("bloodBankId", "name city").limit(500).lean(),
      InventoryUnit.find({ status: "Recalled" }).populate("bloodBankId", "name city").limit(500).lean()
    ]);
    res.json({ expiringSoon: expiring, expired, recalled, generatedAt: now });
  } catch (err) { res.status(500).json({ error: "Unable to load inventory alerts." }); }
});

// 3) Distance-based logistics planning; estimates are not live traffic or dispatch guarantees.
router.post("/logistics/route", requireAdmin, async (req, res) => {
  const { origin, destinations } = req.body || {};
  if (!validPoint(origin) || !Array.isArray(destinations) || destinations.length < 1 || destinations.length > 20 || destinations.some((p) => !validPoint(p))) return res.status(400).json({ error: "Provide valid origin and 1–20 destination coordinates." });
  const distanceKm = (a,b) => { const rad = (n) => n * Math.PI / 180; const dLat = rad(b.lat-a.lat), dLng = rad(b.lng-a.lng); const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2; return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)); };
  const remaining = destinations.map((p, i) => ({ ...p, inputIndex: i, distanceFromOriginKm: distanceKm(origin, p) }));
  const ordered = []; let current = origin;
  while (remaining.length) {
    remaining.sort((a,b) => distanceKm(current,a)-distanceKm(current,b));
    const next = remaining.shift(); next.distanceFromPreviousKm = Math.round(distanceKm(current,next)*10)/10; ordered.push(next); current = next;
  }
  const total = ordered.reduce((sum,p)=>sum+p.distanceFromPreviousKm,0);
  res.json({ route: ordered, estimatedDistanceKm: Math.round(total*10)/10, estimatedDrivingMinutes: Math.round(total/30*60), method: "nearest-neighbour straight-line estimate", disclaimer: "Not road routing, live traffic, medical prioritization or a dispatch guarantee. Verify transport conditions and cold-chain requirements." });
});

// 5) Scoped machine-to-machine integration. Provision keys out-of-band; raw keys are never stored.
function requireIntegration(scope) {
  return async (req, res, next) => {
    const raw = req.headers["x-raktsetu-api-key"];
    if (typeof raw !== "string" || raw.length < 32 || raw.length > 256) return res.status(401).json({ error: "Integration API key required." });
    try {
      const key = await IntegrationKey.findOne({ keyHash: hashKey(raw), active: true }).select("+keyHash");
      if (!key || (key.expiresAt && key.expiresAt <= new Date())) return res.status(401).json({ error: "Invalid integration API key." });
      if (!key.scopes.includes(scope)) return res.status(403).json({ error: "Integration key lacks required scope." });
      // Store usage in MongoDB rather than process memory so the limit
      // survives serverless cold starts and is shared across instances.
      const now = Date.now();
      const windowStart = new Date(Math.floor(now / 60000) * 60000);
      const rateFilter = { keyId: key._id, windowStart };
      let usage;
      try {
        usage = await IntegrationRateWindow.findOneAndUpdate(
          rateFilter,
          { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart.getTime() + 2 * 60 * 60 * 1000) } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (rateErr) {
        // A concurrent first request can race the unique compound index.
        if (rateErr.code !== 11000) throw rateErr;
        usage = await IntegrationRateWindow.findOneAndUpdate(rateFilter, { $inc: { count: 1 } }, { new: true });
      }
      if (!usage || usage.count > 120) return res.status(429).json({ error: "Integration rate limit exceeded. Try again shortly." });
      else window.count += 1;
      key.lastUsedAt = new Date(); await key.save();
      req.integration = key;
      next();
    } catch (err) { res.status(500).json({ error: "Integration authentication failed." }); }
  };
}
router.post("/integrations/keys", requireAdmin, async (req, res) => {
  try {
    const { organizationName, scopes, expiresAt } = req.body || {};
    const allowedScopes = ["requests:read", "inventory:read", "inventory:write"];
    if (typeof organizationName !== "string" || !organizationName.trim() || organizationName.trim().length > 160 || !Array.isArray(scopes) || !scopes.length || scopes.some((s) => !allowedScopes.includes(s))) return res.status(400).json({ error: "Organization and valid scopes are required." });
    const raw = "rkt_" + crypto.randomBytes(32).toString("hex");
    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date())) return res.status(400).json({ error: "Expiry must be a future date." });
    const key = await IntegrationKey.create({ organizationName: String(organizationName).trim(), keyHash: hashKey(raw), scopes, expiresAt: expiry, createdBy: actorOf(req) });
    await audit(actorOf(req), "integration.key_created", "IntegrationKey", key._id, { organizationName: key.organizationName, scopes });
    res.status(201).json({ id: key._id, organizationName: key.organizationName, scopes, expiresAt: key.expiresAt, apiKey: raw, warning: "Copy this key now. It cannot be retrieved again." });
  } catch (err) { res.status(500).json({ error: "Unable to create integration key." }); }
});
router.get("/integrations/keys", requireAdmin, async (req, res) => {
  try { res.json(await IntegrationKey.find().select("-keyHash").sort({ createdAt: -1 }).limit(200).lean()); }
  catch (err) { res.status(500).json({ error: "Unable to list integration keys." }); }
});
router.patch("/integrations/keys/:id/revoke", requireAdmin, async (req, res) => {
  try {
    if (!safeId(req.params.id)) return res.status(400).json({ error: "Invalid integration key ID." });
    const key = await IntegrationKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: "Integration key not found." });
    key.active = false; await key.save();
    await audit(actorOf(req), "integration.key_revoked", "IntegrationKey", key._id, { organizationName: key.organizationName });
    res.json({ id: key._id, active: key.active });
  } catch (err) { res.status(500).json({ error: "Unable to revoke integration key." }); }
});
router.get("/integrations/requests", requireIntegration("requests:read"), async (req, res) => {
  try { res.json(await BloodRequest.find({ status: { $ne: "Fulfilled" } }).select("group units urgency city state status createdAt").sort({ createdAt: -1 }).limit(100).lean()); }
  catch (err) { res.status(500).json({ error: "Unable to retrieve requests." }); }
});
router.get("/integrations/inventory", requireIntegration("inventory:read"), async (req, res) => {
  try { res.json(await InventoryUnit.find({ status: "Available", testStatus: "Passed", expiresAt: { $gt: new Date() } }).select("group component expiresAt bloodBankId").populate("bloodBankId", "name city state").limit(500).lean()); }
  catch (err) { res.status(500).json({ error: "Unable to retrieve inventory." }); }
});
router.post("/integrations/inventory", requireIntegration("inventory:write"), async (req, res) => {
  try {
    const { unitCode, bloodBankId, group, component, collectedAt, expiresAt } = req.body || {};
    if (typeof unitCode !== "string" || !unitCode.trim() || unitCode.trim().length > 80 || !safeId(bloodBankId) || !GROUPS.includes(group) || !COMPONENTS.includes(component)) return res.status(400).json({ error: "Invalid inventory payload." });
    const collected = new Date(collectedAt), expires = new Date(expiresAt), now = new Date();
    if (!Number.isFinite(collected.getTime()) || !Number.isFinite(expires.getTime()) || expires <= collected || !(await BloodBank.exists({ _id: bloodBankId }))) return res.status(400).json({ error: "Invalid dates or blood bank." });
    if (collected > now) return res.status(400).json({ error: "Collection date cannot be in the future." });
    if (expires <= now) return res.status(400).json({ error: "Expired blood units cannot be registered as new inventory." });
    // Integrations may register units but cannot certify clinical testing. A
    // separately authorized blood-bank workflow must record a passed test.
    const unit = await InventoryUnit.create({ unitCode: String(unitCode).trim(), bloodBankId, group, component, collectedAt: collected, expiresAt: expires, testStatus: "Pending", status: "Quarantined", createdBy: req.integration.organizationName, updatedBy: req.integration.organizationName });
    await audit(req.integration.organizationName, "inventory.created.via_api", "InventoryUnit", unit._id, { group, component });
    res.status(201).json({ id: unit._id, unitCode: unit.unitCode, status: unit.status });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ error: "Unit code already exists." }); res.status(500).json({ error: "Unable to add inventory." }); }
});

// 8) Explainable fraud-risk flags for human review; no automatic denial or accusations.
router.get("/risk-review", requireAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 86400000);
    const requests = await BloodRequest.find({ createdAt: { $gte: since } }).select("recipient group units city state status createdAt lat lng").sort({ createdAt: -1 }).limit(1000).lean();
    const byFingerprint = new Map();
    for (const r of requests) {
      const recipient = String(r.recipient || "").trim().toLowerCase();
      // Missing recipient identity is not enough evidence to group separate requests.
      if (!recipient || !GROUPS.includes(r.group)) continue;
      const key = [recipient, r.group, String(r.city || "").trim().toLowerCase(), String(r.state || "").trim().toLowerCase()].join("|");
      if (!byFingerprint.has(key)) byFingerprint.set(key, []);
      byFingerprint.get(key).push(r);
    }
    const flagged = [];
    for (const [key, rows] of byFingerprint) {
      if (rows.length > 1) flagged.push({ reason: "Similar recipient, group and area requested multiple times in seven days", count: rows.length, requestIds: rows.map(r => r._id), risk: rows.length >= 4 ? "High review priority" : "Review" });
    }
    res.json({ windowDays: 7, flaggedGroups: flagged, disclaimer: "Heuristic flags can identify legitimate repeat requests. Review context before taking action; no request is automatically blocked." });
  } catch (err) { res.status(500).json({ error: "Unable to run request risk review." }); }
});

// 9) What-if scenario simulator based on current inventory and historical demand.
router.post("/resilience/simulate", requireAdmin, async (req, res) => {
  try {
    const { extraDemandUnits = 0, closedBloodBankId = "", days = 7 } = req.body || {};
    const shock = Number(extraDemandUnits), horizon = Number(days);
    if (!Number.isInteger(shock) || shock < 0 || shock > 100000 || !Number.isInteger(horizon) || horizon < 1 || horizon > 30) return res.status(400).json({ error: "extraDemandUnits must be 0–100000 and days 1–30." });
    if (closedBloodBankId && !safeId(closedBloodBankId)) return res.status(400).json({ error: "Invalid closed blood bank ID." });
    if (closedBloodBankId && !(await BloodBank.exists({ _id: closedBloodBankId }))) return res.status(404).json({ error: "Blood bank not found." });
    const since = new Date(Date.now() - 30 * 86400000);
    const [requests, units] = await Promise.all([
      BloodRequest.find({ createdAt: { $gte: since } }).select("group units").lean(),
      InventoryUnit.find({ status: "Available", testStatus: "Passed", expiresAt: { $gt: new Date() }, ...(closedBloodBankId ? { bloodBankId: { $ne: closedBloodBankId } } : {}) }).select("group").lean()
    ]);
    const perGroup = GROUPS.map((group, index) => {
      const historical = requests.filter(r => r.group === group).reduce((n,r)=>n+(Number(r.units)||1),0);
      const projected = Math.ceil(historical / 30 * horizon);
      // Distribute the requested shock as whole units without inflating its total.
      const extra = Math.floor(shock / GROUPS.length) + (index < shock % GROUPS.length ? 1 : 0);
      const available = units.filter(u=>u.group===group).length;
      const demand = projected + extra;
      return { group, availableUnits: available, projectedBaselineDemand: projected, scenarioExtraDemand: extra, projectedTotalDemand: demand, projectedGap: Math.max(0,demand-available) };
    });
    res.json({ scenario: { extraDemandUnits: shock, closedBloodBankId: closedBloodBankId || null, horizonDays: horizon }, results: perGroup, disclaimer: "Scenario estimates rely on recorded requests and inventory only; they are not clinical allocation recommendations." });
  } catch (err) { res.status(500).json({ error: "Unable to simulate scenario." }); }
});

router.get("/audit", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    res.json(await OperationsAudit.find().sort({ occurredAt: -1 }).limit(limit).lean());
  } catch (err) { res.status(500).json({ error: "Unable to load audit log." }); }
});

module.exports = router;
