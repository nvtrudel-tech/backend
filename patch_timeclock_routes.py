import sys

path = "backend/routes/timeclock.js"
with open(path, "r") as f:
    content = f.read()

original = content

# Make sure Appointment model is required at the top
old_require = 'const TimeEntry = require("../models/TimeEntry");'
new_require = old_require + '\nconst Appointment = require("../models/Appointment");'
assert old_require in content, "REQUIRE ANCHOR NOT FOUND"
content = content.replace(old_require, new_require, 1)

# Insert the new range route right before module.exports
old = "module.exports = router;"
new = '''// GET /api/timeclock/range/:workerId?start=YYYY-MM-DD&end=YYYY-MM-DD
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

module.exports = router;'''
assert old in content, "MODULE.EXPORTS ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Timeclock routes patched successfully.")
