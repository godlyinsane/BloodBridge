const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const RegisteredBloodBank = require("../models/RegisteredBloodBank");
const { sendOtp, checkOtp } = require("../utils/otp");
const requireAdmin = require("../middleware/requireAdmin");
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Upload a PDF, JPG, or PNG document."), allowed.includes(file.mimetype));
  }
});

const safeBank = (bank) => {
  const obj = bank.toObject ? bank.toObject() : { ...bank };
  delete obj.passwordHash;
  if (obj.documents) obj.documents = obj.documents.map(({ contentBase64, ...meta }) => meta);
  if (obj.inventory) obj.inventory = obj.inventory.map((item) => ({ ...item, _id: item._id }));
  return obj;
};
function bankAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Blood bank login required." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "blood-bank" || !payload.bankId) return res.status(403).json({ error: "Blood bank account required." });
    req.bankId = payload.bankId;
    next();
  } catch { return res.status(401).json({ error: "Session expired. Please log in again." }); }
}
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }

router.get("/public", asyncRoute(async (req, res) => {
  const banks = await RegisteredBloodBank.find({ status: "verified" }).sort({ state: 1, district: 1, name: 1 });
  res.json(banks.map(safeBank));
}));

router.post("/register/send-otp", asyncRoute(async (req, res) => {
  const phone = String(req.body?.phone || "").replace(/[^0-9]/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
  const result = await sendOtp(phone);
  res.json({ message: "Blood bank registration demo OTP generated.", ...result });
}));

router.post("/register", asyncRoute(async (req, res) => {
  const { name, licenseNumber, email, phone, password, confirmPassword, otp, state, district, address = "" } = req.body || {};
  const normalizedPhone = String(phone || "").replace(/[^0-9]/g, "").slice(-10);
  if (![name, licenseNumber, email, normalizedPhone, password, confirmPassword, otp, state, district].every((v) => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Complete all required fields and enter the demo OTP." });
  if (!/^[6-9]\d{9}$/.test(normalizedPhone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
  if (password.length < 8) return res.status(400).json({ error: "Password must contain at least 8 characters." });
  if (password !== confirmPassword) return res.status(400).json({ error: "Password and confirmation do not match." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid official email address." });
  if (!await checkOtp(normalizedPhone, otp)) return res.status(400).json({ error: "Incorrect or expired OTP. Generate a new code." });
  const bank = await RegisteredBloodBank.create({
    name: name.trim(), licenseNumber: licenseNumber.trim(), email: email.trim().toLowerCase(),
    phone: normalizedPhone, passwordHash: await bcrypt.hash(password, 12),
    state: state.trim(), district: district.trim(), address: String(address).trim()
  }).catch((err) => {
    if (err.code === 11000) throw Object.assign(new Error("An account already exists with this email or licence number."), { status: 409 });
    throw err;
  });
  res.status(201).json({ message: "Registration verified. Your facility remains pending until administrator review.", bank: safeBank(bank) });
}));

router.post("/forgot-password/send-otp", asyncRoute(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const bank = await RegisteredBloodBank.findOne({ email });
  if (!bank) return res.status(404).json({ error: "No blood bank account found with that email address." });
  const result = await sendOtp(bank.phone);
  res.json({ message: "Blood bank password reset demo OTP generated.", ...result });
}));

router.post("/forgot-password/reset", asyncRoute(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otp = String(req.body?.otp || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  const bank = await RegisteredBloodBank.findOne({ email });
  if (!bank) return res.status(404).json({ error: "No blood bank account found with that email address." });
  if (newPassword.length < 8) return res.status(400).json({ error: "New password must contain at least 8 characters." });
  if (!await checkOtp(bank.phone, otp)) return res.status(400).json({ error: "Incorrect or expired OTP. Generate a new code." });
  bank.passwordHash = await bcrypt.hash(newPassword, 12);
  await bank.save();
  res.json({ message: "Password reset successfully. Log in with your new password." });
}));

router.post("/login", asyncRoute(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const bank = await RegisteredBloodBank.findOne({ email });
  if (!bank || !(await bcrypt.compare(password, bank.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
  const token = jwt.sign({ role: "blood-bank", bankId: String(bank._id) }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, bank: safeBank(bank) });
}));

router.get("/me", bankAuth, asyncRoute(async (req, res) => {
  const bank = await RegisteredBloodBank.findById(req.bankId);
  if (!bank) return res.status(404).json({ error: "Blood bank account not found." });
  res.json(safeBank(bank));
}));

router.post("/documents", bankAuth, upload.single("document"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a document to upload." });
  const kind = String(req.body?.kind || "");
  if (!["blood_bank_license", "state_noc", "accreditation", "other"].includes(kind)) return res.status(400).json({ error: "Choose a valid document category." });
  const bank = await RegisteredBloodBank.findById(req.bankId);
  if (!bank) return res.status(404).json({ error: "Blood bank account not found." });
  bank.documents.push({ kind, originalName: req.file.originalname.slice(0, 200), mimeType: req.file.mimetype, contentBase64: req.file.buffer.toString("base64"), reviewStatus: "pending" });
  if (bank.status === "rejected") bank.status = "pending";
  await bank.save();
  res.status(201).json({ message: "Document uploaded for review.", bank: safeBank(bank) });
}));

router.get("/documents/:documentId/file", bankAuth, asyncRoute(async (req, res) => {
  const bank = await RegisteredBloodBank.findById(req.bankId);
  const doc = bank?.documents.id(req.params.documentId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.set("Content-Type", doc.mimeType);
  res.set("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(doc.originalName));
  res.set("X-Content-Type-Options", "nosniff");
  res.send(Buffer.from(doc.contentBase64, "base64"));
}));

router.get("/inventory", bankAuth, asyncRoute(async (req, res) => {
  const bank = await RegisteredBloodBank.findById(req.bankId);
  if (!bank) return res.status(404).json({ error: "Blood bank account not found." });
  res.json({ status: bank.status, inventory: bank.inventory, lastInventoryUpdate: bank.lastInventoryUpdate });
}));

router.post("/inventory", bankAuth, asyncRoute(async (req, res) => {
  const { group, component, units, collectedAt, expiresAt, batchCode = "" } = req.body || {};
  const count = Number(units);
  if (!["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].includes(group)) return res.status(400).json({ error: "Choose a valid blood group." });
  if (!["Whole Blood", "Packed Red Cells", "Platelets", "Fresh Frozen Plasma", "Cryoprecipitate"].includes(component)) return res.status(400).json({ error: "Choose a valid blood component." });
  if (!Number.isInteger(count) || count < 0 || count > 10000) return res.status(400).json({ error: "Units must be a whole number from 0 to 10000." });
  if (expiresAt && collectedAt && new Date(expiresAt) <= new Date(collectedAt)) return res.status(400).json({ error: "Expiry date must be after the collection date." });
  const bank = await RegisteredBloodBank.findById(req.bankId);
  if (!bank) return res.status(404).json({ error: "Blood bank account not found." });
  if (bank.status !== "verified") return res.status(403).json({ error: "Inventory updates are available after administrator verification." });
  bank.inventory.push({ group, component, units: count, collectedAt: collectedAt || null, expiresAt: expiresAt || null, batchCode: String(batchCode).trim().slice(0, 80), updatedBy: bank.email, status: expiresAt && new Date(expiresAt) < new Date() ? "expired" : "available" });
  bank.lastInventoryUpdate = new Date();
  await bank.save();
  res.status(201).json({ message: "Inventory entry saved.", inventory: bank.inventory });
}));

router.get("/admin/all", requireAdmin, asyncRoute(async (req, res) => {
  const banks = await RegisteredBloodBank.find().sort({ createdAt: -1 });
  res.json(banks.map(safeBank));
}));

router.get("/admin/:id/documents/:documentId/file", requireAdmin, asyncRoute(async (req, res) => {
  const bank = await RegisteredBloodBank.findById(req.params.id);
  const doc = bank?.documents.id(req.params.documentId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.set("Content-Type", doc.mimeType);
  res.set("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(doc.originalName));
  res.set("X-Content-Type-Options", "nosniff");
  res.send(Buffer.from(doc.contentBase64, "base64"));
}));

router.patch("/admin/:id/review", requireAdmin, asyncRoute(async (req, res) => {
  const { action, reason = "" } = req.body || {};
  if (!["verify", "reject", "suspend"].includes(action)) return res.status(400).json({ error: "Choose verify, reject, or suspend." });
  const bank = await RegisteredBloodBank.findById(req.params.id);
  if (!bank) return res.status(404).json({ error: "Blood bank not found." });
  if (action === "verify") {
    if (!bank.documents.some((d) => d.kind === "blood_bank_license" && d.reviewStatus === "approved")) return res.status(400).json({ error: "A blood-bank licence document is required before verification." });
    bank.status = "verified"; bank.verifiedAt = new Date(); bank.verifiedBy = req.admin?.username || "admin"; bank.rejectionReason = "";
  } else if (action === "reject") {
    bank.status = "rejected"; bank.rejectionReason = String(reason).trim().slice(0, 500); bank.verifiedAt = null;
  } else { bank.status = "suspended"; }
  await bank.save();
  res.json({ message: "Blood bank status updated.", bank: safeBank(bank) });
}));

router.patch("/admin/:id/documents/:documentId", requireAdmin, asyncRoute(async (req, res) => {
  const { action, note = "" } = req.body || {};
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Choose approve or reject." });
  const bank = await RegisteredBloodBank.findById(req.params.id);
  const doc = bank?.documents.id(req.params.documentId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  doc.reviewStatus = action === "approve" ? "approved" : "rejected";
  doc.reviewNote = String(note).trim().slice(0, 500);
  await bank.save();
  res.json({ message: "Document review saved.", bank: safeBank(bank) });
}));

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Documents must be 5 MB or smaller." : "Unable to upload that file." });
  if (err.message?.startsWith("Upload a PDF")) return res.status(400).json({ error: err.message });
  return next(err);
});
module.exports = router;
