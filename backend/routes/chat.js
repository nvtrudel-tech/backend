const express = require("express");
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Appointment = require("../models/Appointment");

const router = express.Router();

// Create or get conversation for an appointment
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

    return res.json(conversation);
  } catch (error) {
    console.error("conversation route error:", error);
    return res.status(500).json({
      message: error.message || "Server error creating conversation",
    });
  }
});

// Get all messages for one appointment
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

    return res.json(messages);
  } catch (error) {
    console.error("fetch messages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get unread counts grouped by appointment for a user
router.get("/unread/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const unreadMessages = await Message.find({
      receiver: userId,
      readBy: { $ne: userId },
    }).select("appointment");

    const counts = {};

    unreadMessages.forEach((msg) => {
      const appointmentId = String(msg.appointment);
      counts[appointmentId] = (counts[appointmentId] || 0) + 1;
    });

    return res.json(counts);
  } catch (error) {
    console.error("unread count error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Mark messages as read for one appointment and one user
router.put("/read/:appointmentId/:userId", async (req, res) => {
  try {
    const { appointmentId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    await Message.updateMany(
      {
        appointment: appointmentId,
        receiver: userId,
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("mark read error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;