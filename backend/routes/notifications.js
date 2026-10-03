const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Worker = require("../models/Worker");

async function findAccount(userId) {
  let account = await User.findById(userId).select("unreadNotifications");
  let Model = User;
  if (!account) {
    account = await Worker.findById(userId).select("unreadNotifications");
    Model = Worker;
  }
  return { account, Model };
}

// GET /api/notifications/unread/:userId
router.get("/unread/:userId", async (req, res) => {
  try {
    const { account } = await findAccount(req.params.userId);
    res.json({ count: account?.unreadNotifications || 0 });
  } catch (err) {
    console.error("Fetch unread notifications error:", err);
    res.status(500).json({ msg: "Server error fetching unread notifications" });
  }
});

// POST /api/notifications/clear/:userId
router.post("/clear/:userId", async (req, res) => {
  try {
    const { account, Model } = await findAccount(req.params.userId);
    if (account) {
      await Model.findByIdAndUpdate(req.params.userId, { unreadNotifications: 0 });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Clear unread notifications error:", err);
    res.status(500).json({ msg: "Server error clearing unread notifications" });
  }
});

module.exports = router;
