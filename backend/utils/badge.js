const User = require("../models/User");
const Worker = require("../models/Worker");
const Message = require("../models/Message");

// The single source of truth for "what should this user's app badge say right now."
// Always combines BOTH unread chat messages and unread appointment notifications,
// so no individual push ever overwrites the OS badge with a partial/incomplete number.
async function getBadgeTotal(userId) {
  let account = await User.findById(userId).select("unreadNotifications");
  if (!account) {
    account = await Worker.findById(userId).select("unreadNotifications");
  }

  const notifCount = account?.unreadNotifications || 0;

  const chatCount = await Message.countDocuments({
    receiver: userId,
    readBy: { $ne: userId },
  });

  return chatCount + notifCount;
}

module.exports = { getBadgeTotal };
