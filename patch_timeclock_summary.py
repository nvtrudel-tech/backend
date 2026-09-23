import sys

path = "backend/routes/timeclock.js"
with open(path, "r") as f:
    content = f.read()

original = content

old = "module.exports = router;"
new = '''// GET /api/timeclock/summary/:workerId -> combined status + today's hours in one call
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

module.exports = router;'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Combined summary endpoint added.")
