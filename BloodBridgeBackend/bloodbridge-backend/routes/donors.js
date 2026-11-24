const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Donor = require("../models/Donor");
const Donation = require("../models/Donation");
const { sendOtp, checkOtp } = require("../utils/otp");
const requireAdmin = require("../middleware/requireAdmin");
const requireDonor = require("../middleware/requireDonor");

const INDIA_DISTRICT_CENTRES = require("../data/indiaDistrictCentres.json");
const DISTRICT_TEST_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DISTRICT_TEST_FIRST_NAMES = ["Aarav", "Ananya", "Rohan", "Priya", "Vivek", "Meera", "Karan", "Sneha", "Rahul", "Kavya", "Aditya", "Isha", "Sanjay", "Nisha", "Manoj", "Pooja", "Arjun", "Diya", "Kabir", "Aditi", "Dev", "Riya", "Ishaan", "Tara"];
const DISTRICT_TEST_LAST_NAMES = ["Sharma", "Verma", "Patel", "Singh", "Gupta", "Joshi", "Yadav", "Rao", "Mishra", "Mehta", "Reddy", "Nair", "Chauhan", "Pandey", "Agarwal", "Das", "Kumar", "Jain", "Sahu", "Tiwari", "Kashyap", "Rathore", "Dewangan", "Bansal"];

async function ensureDistrictTestDonors(state, district) {
  const normalize = (value) => String(value || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const row = INDIA_DISTRICT_CENTRES.districts.find((entry) => normalize(entry[1]) === normalize(district) && normalize(entry[2]) === normalize(state));
  if (!row) return;
  const [districtId, districtName, stateName, centerLat, centerLng] = row;
  const existing = await Donor.aggregate([
    { $match: { isTestData: true, state: stateName, district: districtName } },
    { $group: { _id: "$group", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(existing.map((item) => [item._id, item.count]));
  if (DISTRICT_TEST_GROUPS.every((group) => (counts[group] || 0) >= 8)) return;
  const operations = [];
  const passwordHash = await bcrypt.hash("DemoDonor#2026", 10);
  for (let groupIndex = 0; groupIndex < DISTRICT_TEST_GROUPS.length; groupIndex += 1) {
    const group = DISTRICT_TEST_GROUPS[groupIndex];
    const currentCount = Math.min(8, counts[group] || 0);
    for (let donorIndex = currentCount; donorIndex < 8; donorIndex += 1) {
      const slot = groupIndex * 8 + donorIndex;
      const numericId = Number(districtId);
      const firstIndex = (slot + numericId) % DISTRICT_TEST_FIRST_NAMES.length;
      const lastIndex = (slot * 3 + numericId) % DISTRICT_TEST_LAST_NAMES.length;
      const phone = "00000" + String(districtId).padStart(3, "0") + String(slot + 1).padStart(2, "0");
      const latOffset = (((slot * 7 + numericId) % 9) - 4) * 0.0025;
      const lngOffset = (((slot * 5 + numericId) % 9) - 4) * 0.0025;
      operations.push({
        updateOne: {
          filter: { phone },
          update: { $setOnInsert: {
            name: DISTRICT_TEST_FIRST_NAMES[firstIndex] + " " + DISTRICT_TEST_LAST_NAMES[lastIndex],
            phone, group, gender: slot % 2 === 0 ? "Male" : "Female",
            lat: Number((centerLat + latOffset).toFixed(6)),
            lng: Number((centerLng + lngOffset).toFixed(6)),
            district: districtName, city: districtName,
            locality: "Approx. " + districtName + " area " + (donorIndex + 1),
            state: stateName, available: true, verified: true, isTestData: true,
            bloodGroupStatus: "verified", donationType: "Free", feeAmount: 0,
            totalDonations: 1, lastDonation: new Date("2026-06-15"), passwordHash,
          } },
          upsert: true,
        },
      });
    }
  }
  if (operations.length) {
    try {
      await Donor.bulkWrite(operations, { ordered: false });
    } catch (error) {
      if (error.code !== 11000 && !Array.isArray(error.writeErrors)) throw error;
    }
  }
  const finalCounts = await Donor.aggregate([
    { $match: { isTestData: true, state: stateName, district: districtName } },
    { $group: { _id: "$group", count: { $sum: 1 } } },
  ]);
  const verifiedCounts = Object.fromEntries(finalCounts.map((item) => [item._id, item.count]));
  const missing = DISTRICT_TEST_GROUPS.filter((group) => (verifiedCounts[group] || 0) < 8);
  if (missing.length) throw new Error("Unable to prepare the district donor sample set for " + districtName + ": " + missing.join(", "));
}

function signDonorToken(donor) {
  return jwt.sign({ id: donor._id, phone: donor.phone, role: "donor" }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

// Public directory exposes only non-contact fields; exact coordinates and phone numbers stay private.
router.get("/public", async (req, res) => {
  try {
    const { state, district, group, groups } = req.query;
    const filter = { available: true, verified: true, bloodGroupStatus: "verified" };
    if (state && district) await ensureDistrictTestDonors(state, district);
    const escapeRegex = (value) => String(value).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    if (state) filter.state = new RegExp("^" + escapeRegex(state) + "$", "i");
    if (district) {
      const districtPattern = new RegExp("^" + escapeRegex(district) + "$", "i");
      filter.$or = [{ district: districtPattern }, { city: districtPattern }];
    }
    const requestedGroups = groups
      ? String(groups).split(",").map((value) => value.trim()).filter((value) => ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(value))
      : group ? [String(group)] : [];
    if (requestedGroups.length) filter.group = { $in: requestedGroups };
    const limit = state && district ? 1000 : 500;
    const donors = await Donor.find(filter)
      .select("name phone group locality district city state lat lng available verified bloodGroupStatus donationType")
      .sort({ createdAt: -1 }).limit(limit).lean();
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: "Unable to load the public donor directory." });
  }
});

// Full donor records are restricted to authenticated administrators.
router.get("/", requireAdmin, async (req, res) => {
  try {
    const donors = await Donor.find().select("-passwordHash -bloodGroupDocPath").sort({ createdAt: -1 });
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: "Unable to load donor records." });
  }
});

// POST /api/donors/send-otp  { phone }
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });
    const result = await sendOtp(phone);
    res.json({ message: "OTP sent.", ...result });
  } catch (err) {
    // Twilio trial accounts can only send SMS to verified caller IDs — surface that clearly.
    if (err.code === 60203 || /unverified/i.test(err.message)) {
      return res.status(400).json({
        error: "This number isn't verified on your Twilio trial account. Add it under Phone Numbers → Verified Caller IDs in the Twilio console, or use a different number.",
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donors/register  { name, phone, group, gender, lat, lng, city, state, donationType, feeAmount, password, otp }
router.post("/register", async (req, res) => {
  try {
    const { name, phone, group, gender, lat, lng, district, city, state, donationType, feeAmount, password, otp } = req.body;
    const cleanDistrict = String(district || city || "").trim();
    if (!name || !phone || !group || !gender || lat == null || lng == null || !password || !otp) {
      return res.status(400).json({ error: "All fields including gender, password, and OTP are required." });
    }
    const hasCoordinate = (value) => value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
    const numericLat = Number(lat);
    const numericLng = Number(lng);
    if (!hasCoordinate(lat) || !hasCoordinate(lng) ||
        !Number.isFinite(numericLat) || numericLat < -90 || numericLat > 90 ||
        !Number.isFinite(numericLng) || numericLng < -180 || numericLng > 180) {
      return res.status(400).json({ error: "Enter valid latitude and longitude coordinates." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const isValid = await checkOtp(phone, otp);
    if (!isValid) return res.status(400).json({ error: "Incorrect or expired OTP." });

    const safeDonationType = donationType === "Paid" ? "Paid" : "Free";
    const safeFee = safeDonationType === "Paid" ? Number(feeAmount) || 0 : 0;
    const passwordHash = await bcrypt.hash(password, 10);

    let donor = await Donor.findOne({ phone });
    if (donor) {
      donor.name = name;
      donor.group = group;
      donor.gender = gender;
      donor.lat = numericLat;
      donor.lng = numericLng;
      donor.district = cleanDistrict || donor.district;
      donor.city = cleanDistrict || donor.city;
      donor.state = state || donor.state;
      donor.donationType = safeDonationType;
      donor.feeAmount = safeFee;
      donor.passwordHash = passwordHash;
      donor.verified = true;
    } else {
      donor = new Donor({
        name, phone, group, gender, lat: numericLat, lng: numericLng, district: cleanDistrict, city: cleanDistrict, state,
        donationType: safeDonationType, feeAmount: safeFee, passwordHash, verified: true,
      });
    }
    await donor.save();
    const token = signDonorToken(donor);
    const { passwordHash: _omit, bloodGroupDocPath: _omit2, ...safeDonor } = donor.toObject();
    res.status(201).json({ donor: safeDonor, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donors/login  { phone, password }
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "Phone and password are required." });

    const donor = await Donor.findOne({ phone });
    if (!donor) return res.status(401).json({ error: "Invalid phone number or password." });

    const match = await bcrypt.compare(password, donor.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid phone number or password." });

    const token = signDonorToken(donor);
    const { passwordHash: _omit, bloodGroupDocPath: _omit2, ...safeDonor } = donor.toObject();
    res.json({ donor: safeDonor, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/donors/me  (restores a donor's session on page reload)
router.get("/me", requireDonor, async (req, res) => {
  try {
    const donor = await Donor.findById(req.donor.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    const { passwordHash: _omit, bloodGroupDocPath: _omit2, ...safeDonor } = donor.toObject();
    res.json(safeDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/donors/:id/availability  { available }  (only the donor themselves)
router.patch("/:id/availability", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only update your own availability." });
    }
    const donor = await Donor.findByIdAndUpdate(
      req.params.id,
      { available: req.body.available },
      { new: true }
    ).select("-passwordHash -bloodGroupDocPath");
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/donors/:id/profile  { name, group, gender, city, state, lat, lng }  (only the donor themselves)
router.patch("/:id/profile", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only edit your own profile." });
    }
    const { name, group, gender, district, city, state, lat, lng, donationType, feeAmount } = req.body;
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });

    if (name) donor.name = name;
    if (group) donor.group = group;
    if (gender) donor.gender = gender;
    if (district !== undefined || city !== undefined) { donor.district = String(district || city || "").trim(); donor.city = donor.district; }
    if (state !== undefined) donor.state = state;
    if (lat != null) donor.lat = lat;
    if (lng != null) donor.lng = lng;
    if (donationType) {
      donor.donationType = donationType === "Paid" ? "Paid" : "Free";
      donor.feeAmount = donor.donationType === "Paid" ? Number(feeAmount) || 0 : 0;
    }

    await donor.save();
    const { passwordHash: _omit, bloodGroupDocPath: _omit2, ...safeDonor } = donor.toObject();
    res.json(safeDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/donors/:id/password  { currentPassword, newPassword }  (only the donor themselves)
router.patch("/:id/password", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only change your own password." });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });

    const match = await bcrypt.compare(currentPassword, donor.passwordHash);
    if (!match) return res.status(401).json({ error: "Current password is incorrect." });

    donor.passwordHash = await bcrypt.hash(newPassword, 10);
    await donor.save();
    res.json({ message: "Password updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donors/forgot-password/send-otp  { phone }  (no login required)
router.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });
    const donor = await Donor.findOne({ phone });
    if (!donor) return res.status(404).json({ error: "No account found with that phone number." });
    const result = await sendOtp(phone);
    res.json({ message: "OTP sent.", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donors/forgot-password/reset  { phone, otp, newPassword }  (no login required)
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: "Phone, OTP, and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }
    const isValid = await checkOtp(phone, otp);
    if (!isValid) return res.status(400).json({ error: "Incorrect or expired OTP." });

    const donor = await Donor.findOne({ phone });
    if (!donor) return res.status(404).json({ error: "No account found with that phone number." });

    donor.passwordHash = await bcrypt.hash(newPassword, 10);
    await donor.save();
    res.json({ message: "Password reset. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donors/:id/donations  { donationDate, patientName, location, hospitalName, type }
// Donor self-registers their last donation — updates lastDonation (for the eligibility
// tracker) and increments totalDonations.
router.post("/:id/donations", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only register your own donations." });
    }
    const { donationDate, patientName, location, hospitalName, type } = req.body;
    if (!donationDate) return res.status(400).json({ error: "Donated date is required." });

    const donation = await Donation.create({
      donorId: req.params.id,
      donationDate: new Date(donationDate),
      patientName, location, hospitalName,
      type: type || "Blood",
    });

    const donor = await Donor.findById(req.params.id);
    if (donor) {
      const newDate = new Date(donationDate);
      if (!donor.lastDonation || newDate > new Date(donor.lastDonation)) {
        donor.lastDonation = newDate;
      }
      donor.totalDonations = (donor.totalDonations || 0) + 1;
      await donor.save();
    }

    res.status(201).json(donation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/donors/:id/donations  (only the donor themselves)
router.get("/:id/donations", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only view your own donation history." });
    }
    const donations = await Donation.find({ donorId: req.params.id }).sort({ donationDate: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/donors/:id  (only the donor themselves — delete profile / unsubscribe)
router.delete("/:id", requireDonor, async (req, res) => {
  try {
    if (req.donor.id !== req.params.id) {
      return res.status(403).json({ error: "You can only delete your own profile." });
    }
    await Donor.findByIdAndDelete(req.params.id);
    await Donation.deleteMany({ donorId: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/donors/:id/verify  (admin only)
router.patch("/:id/verify", requireAdmin, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ error: "Donor not found." });
    donor.verified = !donor.verified;
    await donor.save();
    const { passwordHash: _omit, bloodGroupDocPath: _omit2, ...safeDonor } = donor.toObject();
    res.json(safeDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
