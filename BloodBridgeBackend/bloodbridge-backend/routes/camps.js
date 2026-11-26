const express = require("express");
const router = express.Router();
const DonationCamp = require("../models/DonationCamp");

// GET all camps, soonest first
router.get("/", async (req, res) => {
  try {
    const camps = await DonationCamp.find().sort({ date: 1 });
    res.json(camps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
