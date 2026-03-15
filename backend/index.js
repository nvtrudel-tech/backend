// index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const workerRoutes = require("./routes/workers");
const chatRoutes = require("./routes/chat");

const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const Appointment = require("./models/Appointment");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Backend running!" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/chat", chatRoutes);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join_conversation", async ({ appointmentId, userId }) => {
    try {
      if (!appointmentId || !userId) return;

      const roomName = `appointment_${appointmentId}`;
      socket.join(roomName);

      console.log(`👤 User ${userId} joined room ${roomName}`);
    } catch (error) {
      console.error("❌ join_conversation error:", error);
    }
  });

  socket.on("send_message", async (payload, callback) => {
    try {
      const { appointmentId, senderId, receiverId, text } = payload;

      if (!appointmentId || !senderId || !receiverId || !text || !text.trim()) {
        return callback?.({ ok: false, message: "Missing required fields" });
      }

      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        return callback?.({ ok: false, message: "Appointment not found" });
      }

      const customerId =
        appointment.customer?._id?.toString?.() ||
        appointment.customer?.toString?.();

      const workerId =
        appointment.worker?._id?.toString?.() ||
        appointment.worker?.toString?.();

      const allowedUsers = [customerId, workerId];

      if (!allowedUsers.includes(senderId) || !allowedUsers.includes(receiverId)) {
        return callback?.({ ok: false, message: "Not authorized for this chat" });
      }

      let conversation = await Conversation.findOne({ appointment: appointmentId });

      if (!conversation) {
        conversation = await Conversation.create({
          appointment: appointment._id,
          customer: customerId,
          worker: workerId,
          lastMessage: text.trim(),
          lastMessageAt: new Date(),
        });
      }

      const newMessage = await Message.create({
        conversation: conversation._id,
        appointment: appointmentId,
        sender: senderId,
        receiver: receiverId,
        text: text.trim(),
        readBy: [senderId],
      });

      conversation.lastMessage = text.trim();
      conversation.lastMessageAt = new Date();
      await conversation.save();

      const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "_id name")
        .populate("receiver", "_id name");

      io.to(`appointment_${appointmentId}`).emit("receive_message", populatedMessage);

      return callback?.({ ok: true, message: populatedMessage });
    } catch (error) {
      console.error("❌ send_message error:", error);
      return callback?.({ ok: false, message: error.message || "Server error" });
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);
  });
});

// MongoDB + start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });