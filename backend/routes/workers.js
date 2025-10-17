// routes/workers.js
const express = require("express");
const Worker = require("../models/Worker");
const router = express.Router();

// ✅ Get all workers
router.get("/", async (req, res) => {
  const workers = await Worker.find();
  res.json(workers);
});

// ✅ Create new worker
router.post("/", async (req, res) => {
  const worker = new Worker(req.body);
  await worker.save();
  res.json(worker);
});

// ✅ Update worker info
router.put("/:id", async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(worker);
});

// ✅ Delete worker
router.delete("/:id", async (req, res) => {
  await Worker.findByIdAndDelete(req.params.id);
  res.json({ msg: "Worker deleted" });
});

// ✅ Clock in
router.post("/:id/clock-in", async (req, res) => {
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ msg: "Worker not found" });

  worker.currentClock.clockedIn = true;
  worker.currentClock.clockInTime = new Date();
  worker.currentClock.clockOutTime = null;
  await worker.save();

  res.json({ msg: "Clocked in", worker });
});

// ✅ Clock out
router.post("/:id/clock-out", async (req, res) => {
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ msg: "Worker not found" });

  const now = new Date();
  const start = new Date(worker.currentClock.clockInTime);
  const hoursWorked = (now - start) / (1000 * 60 * 60); // hours

  worker.currentClock.clockedIn = false;
  worker.currentClock.clockOutTime = now;
  worker.currentClock.totalHoursToday += hoursWorked;
  await worker.save();

  res.json({ msg: "Clocked out", worker });
});

module.exports = router;
