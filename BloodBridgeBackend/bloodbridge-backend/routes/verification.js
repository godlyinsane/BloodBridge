const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const multer = require("multer");
const Donor = require("../models/Donor");
const Notification = require("../models/Notification");
const requireDonor = require("../middleware/requireDonor");
const requireAdmin = require("../middleware/requireAdmin");

// Verification documents are stored in Vercel Blob with private access.
// Keep the SDK import dynamic so this CommonJS Express app can use its ESM SDK.
async function loadBlobSdk() {
  return import("@vercel/blob");
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or PDF files are allowed."));
    }
    cb(null, true);
  },
});

function detectDocumentType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: ".jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", extension: ".png" };
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mime: "application/pdf", extension: ".pdf" };
  }
  return null;
}

function safeOriginalName(originalname) {
  const normalized = String(originalname || "verification-document").replace(/\\/g, "/");
  return path.basename(normalized).slice(0, 180) || "verification-document";
}

async function notifyDonor(donorId, message, type) {
  await Notification.create({ donorId, message, type });
}

// POST /api/donors/:id/verification/upload  (multipart/form-data: document)
router.post("/:id/verification/upload", requireDonor, (req, res) => {
  if (req.donor.id !== req.params.id) {
    return res.status(403).json({ error: "You can only upload your own document." });
  }

  upload.single("document")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    let uploadedPath = "";
    try {
      if (!req.file) {
        return res.status(400).json({ error: "A document (JPG, PNG, or PDF) is required." });
      }

      // MIME headers alone can be spoofed, so verify the actual file signature too.
      const documentType = detectDocumentType(req.file.buffer);
      if (!documentType || documentType.mime !== req.file.mimetype) {
        return res.status(400).json({ error: "The file contents do not match a supported JPG, PNG, or PDF document." });
      }

      const donor = await Donor.findById(req.params.id);
      if (!donor) return res.status(404).json({ error: "Donor not found." });

      const { put, del } = await loadBlobSdk();
      const blob = await put(
        `verification-docs/${donor._id}/${Date.now()}${documentType.extension}`,
        req.file.buffer,
        {
          access: "private",
          contentType: documentType.mime,
          addRandomSuffix: true,
        }
      );
      uploadedPath = blob.pathname;

      const previousPath = donor.bloodGroupDocPath;
      donor.bloodGroupDocPath = `blob:${blob.pathname}`;
      donor.bloodGroupDocOriginalName = safeOriginalName(req.file.originalname);
      donor.bloodGroupStatus = "pending";
      donor.bloodGroupVerifiedBy = "";
      donor.bloodGroupVerifiedAt = null;
      donor.bloodGroupRejectionReason = "";

      try {
        await donor.save();
        uploadedPath = ""; // MongoDB now references the stored Blob; don't delete it on later notification errors.
      } catch (saveError) {
        // If MongoDB rejects the update, remove the newly uploaded object so it
        // cannot become an orphan. Keep the previously saved document untouched.
        try { await del(uploadedPath, { access: "private" }); } catch {}
        uploadedPath = "";
        throw saveError;
      }

      // Only remove the previous object after MongoDB points at the new one.
      if (previousPath && previousPath.startsWith("blob:")) {
        try {
          await del(previousPath.slice("blob:".length), { access: "private" });
        } catch (deleteError) {
          console.error("Could not delete replaced private verification document:", deleteError.message);
        }
      } else if (previousPath && fs.existsSync(previousPath)) {
        // Compatibility cleanup for an old /tmp-based upload, if it still exists
        // in a warm function instance.
        try { fs.unlinkSync(previousPath); } catch {}
      }

      await notifyDonor(
        donor._id,
        "Your blood group document was submitted and is now pending admin review.",
        "verification_status"
      );

      res.json({
        message: "Document uploaded. Awaiting admin review.",
        bloodGroupStatus: donor.bloodGroupStatus,
      });
    } catch (e) {
      if (uploadedPath) {
        try {
          const { del } = await loadBlobSdk();
          await del(uploadedPath, { access: "private" });
        } catch {}
      }
      console.error("Verification document upload failed:", e.message);
      res.status(500).json({ error: "Could not store the verification document. Please try again." });
    }
  });
});

// GET /api/donors/:id/verification  (donor checks their own status)
router.get("/:id/verification", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only view your own verification status." });
    }
    const donor = await Donor.findById(req.params.id).select(
      "group bloodGroupStatus bloodGroupDocOriginalName bloodGroupVerifiedBy bloodGroupVerifiedAt bloodGroupRejectionReason"
    );
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/donors/:id/notifications
router.get("/:id/notifications", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only view your own notifications." });
    }
    const notifications = await Notification.find({ donorId: req.params.id }).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/donors/:id/notifications/:notifId/read
router.patch("/:id/notifications/:notifId/read", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only update your own notifications." });
    }
    await Notification.findByIdAndUpdate(req.params.notifId, { read: true });
    res.json({ message: "Marked as read." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------
// ADMIN REVIEW ROUTES
// ---------------------------------------------------------------

// GET /api/admin/verification/pending
router.get("/admin/verification/pending", requireAdmin, async (req, res) => {
  try {
    const donors = await Donor.find({ bloodGroupStatus: "pending" }).select(
      "name phone group city state bloodGroupStatus bloodGroupDocOriginalName createdAt"
    );
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/verification/all  (full queue: pending + rejected + verified, for the admin table)
router.get("/admin/verification/all", requireAdmin, async (req, res) => {
  try {
    const donors = await Donor.find({ bloodGroupDocPath: { $exists: true, $ne: "" } }).select(
      "name phone group city state bloodGroupStatus bloodGroupDocOriginalName bloodGroupVerifiedBy bloodGroupVerifiedAt bloodGroupRejectionReason"
    ).sort({ updatedAt: -1 });
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/verification/:donorId/document  (streams the file — admin only, never public)
router.get("/admin/verification/:donorId/document", requireAdmin, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.donorId);
    if (!donor || !donor.bloodGroupDocPath) {
      return res.status(404).json({ error: "No document on file." });
    }

    res.set({
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="verification-document"',
    });

    // New documents use a private Blob pathname, not a public URL.
    if (donor.bloodGroupDocPath.startsWith("blob:")) {
      const { get } = await loadBlobSdk();
      const result = await get(donor.bloodGroupDocPath.slice("blob:".length), {
        access: "private",
      });

      if (!result || result.statusCode !== 200 || !result.stream) {
        return res.status(404).json({ error: "Document file not found in private storage." });
      }

      res.set("Content-Type", result.blob.contentType || "application/octet-stream");
      return Readable.fromWeb(result.stream).pipe(res);
    }

    // Backward compatibility for any old /tmp path that still exists.
    if (!fs.existsSync(donor.bloodGroupDocPath)) {
      return res.status(404).json({ error: "Document file missing from temporary storage." });
    }
    return res.sendFile(path.resolve(donor.bloodGroupDocPath));
  } catch (err) {
    console.error("Verification document retrieval failed:", err.message);
    return res.status(500).json({ error: "Could not retrieve the verification document." });
  }
});

// PATCH /api/admin/verification/:donorId  { action: "approve" | "reject", reason }
router.patch("/admin/verification/:donorId", requireAdmin, async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'." });
    }
    const donor = await Donor.findById(req.params.donorId);
    if (!donor) return res.status(404).json({ error: "Donor not found." });

    donor.bloodGroupStatus = action === "approve" ? "verified" : "rejected";
    donor.bloodGroupVerifiedBy = req.admin.username;
    donor.bloodGroupVerifiedAt = new Date();
    donor.bloodGroupRejectionReason = action === "reject" ? (reason || "Document did not match entered blood group.") : "";
    await donor.save();

    const message = action === "approve"
      ? `Your blood group (${donor.group}) has been verified by an administrator.`
      : `Your blood group verification was rejected: ${donor.bloodGroupRejectionReason}. You can re-upload a document.`;
    await notifyDonor(donor._id, message, "verification_status");

    const { passwordHash: _omit, bloodGroupDocPath: _omit2, ...safeDonor } = donor.toObject();
    res.json(safeDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verification/remind-stale  — nudges donors still unverified after N days
// (Call this manually or wire to a cron job later; kept as a simple on-demand endpoint for now.)
router.post("/admin/verification/remind-stale", requireAdmin, async (req, res) => {
  try {
    const days = Number(req.body.days) || 7;
    const cutoff = new Date(Date.now() - days * 86400000);
    const stale = await Donor.find({
      bloodGroupStatus: "unverified",
      createdAt: { $lte: cutoff },
      $or: [{ bloodGroupReminderSentAt: null }, { bloodGroupReminderSentAt: { $lte: cutoff } }],
    });
    for (const donor of stale) {
      await notifyDonor(
        donor._id,
        "Reminder: your blood group is still unverified. Upload a lab report or donor card to get the ✅ Verified badge.",
        "verification_reminder"
      );
      donor.bloodGroupReminderSentAt = new Date();
      await donor.save();
    }
    res.json({ remindersSent: stale.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
