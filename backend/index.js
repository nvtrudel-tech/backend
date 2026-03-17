require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const workerRoutes = require("./routes/workers");
const chatRoutes = require("./routes/chat");

const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const Appointment = require("./models/Appointment");
const User = require("./models/User");
const Worker = require("./models/Worker");

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

// Push notification helper
async function sendPushNotification(token, message, senderName = "New Message") {
  if (!token) {
    console.log("❌ No push token provided");
    return;
  }

  try {
    const payload = {
      to: token,
      sound: "default",
      title: senderName,
      body: message,
      data: {
        type: "chat",
      },
    };

    console.log("📨 Push payload:", payload);

    const response = await axios.post(
      "https://exp.host/--/api/v2/push/send",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Push sent!", response.data);
  } catch (error) {
    console.error(
      "❌ Push error:",
      error?.response?.data || error.message || error
    );
  }
}

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

      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return callback?.({ ok: false, message: "Invalid appointment ID" });
      }

      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        return callback?.({ ok: false, message: "Appointment not found" });
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
        return callback?.({
          ok: false,
          message: "Appointment must have both customer and worker assigned",
        });
      }

      const sender = String(senderId);
      const receiver = String(receiverId);
      const allowedUsers = [String(customerId), String(workerId)];

      console.log("📩 send_message payload:", {
        appointmentId,
        sender,
        receiver,
        text: text.trim(),
      });

      console.log("🔐 socket auth check:", {
        customerId,
        workerId,
        allowedUsers,
      });

      if (!allowedUsers.includes(sender) || !allowedUsers.includes(receiver)) {
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
        sender: sender,
        receiver: receiver,
        text: text.trim(),
        readBy: [sender],
      });

      conversation.lastMessage = text.trim();
      conversation.lastMessageAt = new Date();
      await conversation.save();

      const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "_id name")
        .populate("receiver", "_id name");

      io.to(`appointment_${appointmentId}`).emit("receive_message", populatedMessage);

      // Find receiver in User or Worker collection
      let receiverDoc = await User.findById(receiver).select("expoPushToken name");
      if (!receiverDoc) {
        receiverDoc = await Worker.findById(receiver).select("expoPushToken name");
      }

      const receiverToken = receiverDoc?.expoPushToken || null;
      const senderName =
        typeof populatedMessage?.sender === "object" && populatedMessage?.sender?.name
          ? populatedMessage.sender.name
          : "New Message";

      console.log("🔔 receiver token:", receiverToken || "none");

      if (receiverToken) {
        await sendPushNotification(receiverToken, text.trim(), senderName);
      } else {
        console.log("❌ No valid receiver token found");
      }

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