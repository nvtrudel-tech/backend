const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// Get chat history for a specific appointment
router.get("/:appointmentId", async (req, res) => {
  try {
    const messages = await Message.find({ 
      appointmentId: req.params.appointmentId 
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching messages" });
  }
});

// Post a new message
router.post("/", async (req, res) => {
  const { appointmentId, senderId, text } = req.body;
  try {
    const newMessage = new Message({
      appointmentId,
      senderId,
      text
    });
    await newMessage.save();
    res.json(newMessage);
  } catch (err) {
    res.status(500).json({ msg: "Error saving message" });
  }
});

module.exports = router;