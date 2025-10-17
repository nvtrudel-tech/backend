// routes/appointments.js
const express = require("express");
const Appointment = require("../models/Appointment");
const router = express.Router();

// ✅ Get all appointments
router.get("/", async (req, res) => {
  const appointments = await Appointment.find().populate("customer worker");
  res.json(appointments);
});

// ✅ Create appointment
router.post("/", async (req, res) => {
  const { customer, worker, service, date } = req.body;
  const appointment = new Appointment({ customer, worker, service, date });
  await appointment.save();
  res.json(appointment);
});

// ✅ Update appointment
router.put("/:id", async (req, res) => {
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(appointment);
});

// ✅ Delete appointment
router.delete("/:id", async (req, res) => {
  await Appointment.findByIdAndDelete(req.params.id);
  res.json({ msg: "Deleted" });
});

module.exports = router;
