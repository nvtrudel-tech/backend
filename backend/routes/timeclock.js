const express = require("express");
const router = express.Router();
const TimeEntry = require("../models/TimeEntry");
const Appointment = require("../models/Appointment");

// Helper: find any currently-open entry (work or break) for a worker
async function findOpenEntry(workerId) {
  return TimeEntry.findOne({ workerId, endTime: null }).sort({ startTime: -1 });
}

// POST /api/timeclock/clock-in  { workerId, appointmentId }
router.post("/clock-in", async (req, res) => {
  try {
    const { workerId, appointmentId } = req.body;
    if (!workerId || !appointmentId) {
      return res.status(400).json({ msg: "workerId and appointmentId are required" });
    }

    const openEntry = await findOpenEntry(workerId);
    let flaggedAnomaly = false;

    if (openEntry) {
      // Worker already has an open entry (maybe forgot to clock out of a previous job).
      // We flag it rather than silently closing it, so the employer can review.
      openEntry.flaggedAnomaly = true;
      await openEntry.save();
      flaggedAnomaly = true;
    }

    const entry = await TimeEntry.create({
      workerId,
      appointmentId,
      type: "work",
      startTime: new Date(),
    });

    res.status(201).json({ entry, flaggedPreviousEntry: flaggedAnomaly });
  } catch (err) {
    console.error("Clock-in error:", err);
    res.status(500).json({ msg: "Server error during clock-in" });
  }
});

// POST /api/timeclock/break-start  { workerId }
router.post("/break-start", async (req, res) => {
  try {
    const { workerId } = req.body;
    const openEntry = await findOpenEntry(workerId);

    if (!openEntry || openEntry.type !== "work") {
      return res.status(400).json({ msg: "No active work session to pause for a break" });
    }

    openEntry.endTime = new Date();
    await openEntry.save();

    const breakEntry = await TimeEntry.create({
      workerId,
      appointmentId: openEntry.appointmentId,
      type: "break",
      startTime: new Date(),
    });

    res.json({ breakEntry });
  } catch (err) {
    console.error("Break-start error:", err);
    res.status(500).json({ msg: "Server error starting break" });
  }
});

// POST /api/timeclock/break-end  { workerId }
router.post("/break-end", async (req, res) => {
  try {
    const { workerId } = req.body;
    const openEntry = await findOpenEntry(workerId);

    if (!openEntry || openEntry.type !== "break") {
      return res.status(400).json({ msg: "No active break to end" });
    }

    openEntry.endTime = new Date();
    await openEntry.save();

    const workEntry = await TimeEntry.create({
      workerId,
      appointmentId: openEntry.appointmentId,
      type: "work",
      startTime: new Date(),
    });

    res.json({ workEntry });
  } catch (err) {
    console.error("Break-end error:", err);
    res.status(500).json({ msg: "Server error ending break" });
  }
});

// POST /api/timeclock/clock-out  { workerId }
router.post("/clock-out", async (req, res) => {
  try {
    const { workerId } = req.body;
    const openEntry = await findOpenEntry(workerId);

    if (!openEntry) {
      return res.status(400).json({ msg: "No active clock-in to close" });
    }

    openEntry.endTime = new Date();
    await openEntry.save();

    res.json({ entry: openEntry });
  } catch (err) {
    console.error("Clock-out error:", err);
    res.status(500).json({ msg: "Server error during clock-out" });
  }
});

// GET /api/timeclock/job/:appointmentId  -> total work hours for that job
router.get("/job/:appointmentId", async (req, res) => {
  try {
    const entries = await TimeEntry.find({
      appointmentId: req.params.appointmentId,
      type: "work",
    });

    const totalMs = entries.reduce((sum, e) => {
      const end = e.endTime || new Date(); // still clocked in counts up to now
      return sum + (end - e.startTime);
    }, 0);

    res.json({
      appointmentId: req.params.appointmentId,
      totalHours: +(totalMs / 1000 / 60 / 60).toFixed(2),
      entries,
    });
  } catch (err) {
    console.error("Job hours error:", err);
    res.status(500).json({ msg: "Server error fetching job hours" });
  }
});

// GET /api/timeclock/daily/:workerId?date=YYYY-MM-DD -> total work hours that day
router.get("/daily/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const dateParam = req.query.date ? new Date(req.query.date) : new Date();

    const dayStart = new Date(dateParam);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateParam);
    dayEnd.setHours(23, 59, 59, 999);

    const entries = await TimeEntry.find({
      workerId,
      type: "work",
      startTime: { $gte: dayStart, $lte: dayEnd },
    });

    const totalMs = entries.reduce((sum, e) => {
      const end = e.endTime || new Date();
      return sum + (end - e.startTime);
    }, 0);

    res.json({
      workerId,
      date: dayStart.toISOString().slice(0, 10),
      totalHours: +(totalMs / 1000 / 60 / 60).toFixed(2),
      entries,
    });
  } catch (err) {
    console.error("Daily hours error:", err);
    res.status(500).json({ msg: "Server error fetching daily hours" });
  }
});

// GET /api/timeclock/status/:workerId -> is worker currently clocked in/on break?
router.get("/status/:workerId", async (req, res) => {
  try {
    const openEntry = await findOpenEntry(req.params.workerId);
    if (!openEntry) {
      return res.json({ status: "clocked_out" });
    }
    res.json({
      status: openEntry.type === "work" ? "clocked_in" : "on_break",
      entry: openEntry,
    });
  } catch (err) {
    console.error("Status error:", err);
    res.status(500).json({ msg: "Server error fetching status" });
  }
});

// GET /api/timeclock/range/:workerId?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns hours grouped by day, with each day broken down by job.
router.get("/range/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;

    const start = req.query.start
      ? new Date(req.query.start)
      : new Date(new Date().setDate(new Date().getDate() - 6));
    start.setHours(0, 0, 0, 0);

    const end = req.query.end ? new Date(req.query.end) : new Date();
    end.setHours(23, 59, 59, 999);

    const entries = await TimeEntry.find({
      workerId,
      type: "work",
      startTime: { $gte: start, $lte: end },
    })
      .populate("appointmentId", "service address date")
      .sort({ startTime: 1 });

    const dayMap = {};

    for (const e of entries) {
      const day = e.startTime.toISOString().slice(0, 10);
      if (!dayMap[day]) {
        dayMap[day] = { date: day, totalHours: 0, jobs: {} };
      }

      const segmentEnd = e.endTime || new Date();
      const hours = (segmentEnd - e.startTime) / 1000 / 60 / 60;
      dayMap[day].totalHours += hours;

      const appt = e.appointmentId;
      const jobId = appt?._id ? appt._id.toString() : String(e.appointmentId);

      if (!dayMap[day].jobs[jobId]) {
        dayMap[day].jobs[jobId] = {
          appointmentId: jobId,
          service: appt?.service || "Unknown",
          address: appt?.address || "",
          totalHours: 0,
          segments: [],
        };
      }

      dayMap[day].jobs[jobId].totalHours += hours;
      dayMap[day].jobs[jobId].segments.push({
        startTime: e.startTime,
        endTime: e.endTime,
        flaggedAnomaly: e.flaggedAnomaly,
      });
    }

    const days = Object.values(dayMap)
      .map((d) => ({
        date: d.date,
        totalHours: +d.totalHours.toFixed(2),
        jobs: Object.values(d.jobs).map((j) => ({
          ...j,
          totalHours: +j.totalHours.toFixed(2),
        })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      workerId,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      days,
    });
  } catch (err) {
    console.error("Range hours error:", err);
    res.status(500).json({ msg: "Server error fetching range hours" });
  }
});

// GET /api/timeclock/summary/:workerId -> combined status + today's hours in one call
router.get("/summary/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;

    const openEntry = await TimeEntry.findOne({ workerId, endTime: null }).sort({
      startTime: -1,
    });

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const todaysEntries = await TimeEntry.find({
      workerId,
      type: "work",
      startTime: { $gte: dayStart, $lte: dayEnd },
    });

    const totalMs = todaysEntries.reduce((sum, e) => {
      const end = e.endTime || new Date();
      return sum + (end - e.startTime);
    }, 0);

    res.json({
      status: openEntry ? (openEntry.type === "work" ? "clocked_in" : "on_break") : "clocked_out",
      activeAppointmentId: openEntry ? openEntry.appointmentId : null,
      dailyHours: +(totalMs / 1000 / 60 / 60).toFixed(2),
    });
  } catch (err) {
    console.error("Timeclock summary error:", err);
    res.status(500).json({ msg: "Server error fetching timeclock summary" });
  }
});

module.exports = router;
