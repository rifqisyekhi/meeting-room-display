const express = require("express");
const router = express.Router();

const { getTodayEvents, getUpcomingEvents, getYearSummary } = require("../services/calendar.service");

router.get("/today", async (req, res) => {
  try {
    if (!process.env.GOOGLE_CALENDAR_ID) {
      throw new Error("GOOGLE_CALENDAR_ID is not configured");
    }

    const events = await getTodayEvents(process.env.GOOGLE_CALENDAR_ID);

    res.json(events);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/upcoming", async (req, res) => {
  try {
    if (!process.env.GOOGLE_CALENDAR_ID) {
      throw new Error("GOOGLE_CALENDAR_ID is not configured");
    }

    const events = await getUpcomingEvents(process.env.GOOGLE_CALENDAR_ID);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/summary/year", async (req, res) => {
  try {
    if (!process.env.GOOGLE_CALENDAR_ID) {
      throw new Error("GOOGLE_CALENDAR_ID is not configured");
    }

    res.json(await getYearSummary(process.env.GOOGLE_CALENDAR_ID));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
