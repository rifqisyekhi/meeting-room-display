const express = require("express");
const router = express.Router();

const { getPrayerTimes } = require("../services/prayer.service");

router.get("/today", async (req, res) => {
  try {
    res.json(await getPrayerTimes());
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
