const express = require("express");
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Appointment = require("../models/Appointment");

const router = express.Router();

console.log("✅ chat.js loaded");

// test route
router.get("/ping", (req, res) => {
  res.json({ message: "chat route is working" });
});

// browser-testable route
router.get("/conversation/:appointmentId", async (req, res) => {
  const { appointmentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ message: "Invalid appointment ID" });
  }

  return res.json({ message: "Conversation route exists", appointmentId });
});

// create or get conversation
router.post("/conversation/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const customerId =
      appointment.customer?._id?.toString?.() ||
      appointment.customer?.toString?.() ||
      null;

    const workerId =
      appointment.worker?._id?.toString?.() ||
      appointment.worker?.toString?.() ||
      null;

    if (!customerId || !workerId) {
      return res.status(400).json({
        message: "Appointment must have both customer and worker assigned",
      });
    }

    let conversation = await Conversation.findOne({ appointment: appointmentId });

    if (!conversation) {
      conversation = await Conversation.create({
        appointment: appointment._id,
        customer: customerId,
        worker: workerId,
        lastMessage: "",
        lastMessageAt: null,
      });
    }

    return res.status(200).json(conversation);
  } catch (error) {
    console.error("conversation route error:", error);
    return res.status(500).json({
      message: error.message || "Server error creating conversation",
    });
  }
});

router.get("/messages/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    const conversation = await Conversation.findOne({ appointment: appointmentId });

    if (!conversation) {
      return res.json([]);
    }

    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .populate("sender", "_id name")
      .populate("receiver", "_id name");

    return res.status(200).json(messages);
  } catch (error) {
    console.error("fetch messages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;