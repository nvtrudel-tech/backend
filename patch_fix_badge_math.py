import sys

# 1. backend/index.js - chat push uses combined total, not just chat-unread count
path = "backend/index.js"
with open(path, "r") as f:
    content = f.read()
original = content

old_require = '''const User = require("./models/User");
const Worker = require("./models/Worker");'''
new_require = '''const User = require("./models/User");
const Worker = require("./models/Worker");
const { getBadgeTotal } = require("./utils/badge");'''
assert old_require in content, "index.js REQUIRE ANCHOR NOT FOUND"
content = content.replace(old_require, new_require, 1)

old_call = '''      if (receiverToken) {
        const unreadBadgeCount = await Message.countDocuments({
          receiver,
          readBy: { $ne: receiver },
        });
        await sendPushNotification(receiverToken, lastMessagePreview, senderName, unreadBadgeCount);
      } else {
        console.log("❌ No valid receiver token found");
      }'''
new_call = '''      if (receiverToken) {
        const unreadBadgeCount = await getBadgeTotal(receiver);
        await sendPushNotification(receiverToken, lastMessagePreview, senderName, unreadBadgeCount);
      } else {
        console.log("❌ No valid receiver token found");
      }'''
assert old_call in content, "index.js CALL SITE ANCHOR NOT FOUND"
content = content.replace(old_call, new_call, 1)

if content == original:
    print("NO CHANGES MADE to index.js")
    sys.exit(1)
with open(path, "w") as f:
    f.write(content)
print("index.js patched: chat push badge now uses combined total.")

# 2. backend/routes/appointments.js - bumpNotificationBadge returns combined total
path = "backend/routes/appointments.js"
with open(path, "r") as f:
    content = f.read()
original = content

old_require2 = '''const { sendBookingConfirmationEmails } = require("../utils/mailer");'''
new_require2 = '''const { sendBookingConfirmationEmails } = require("../utils/mailer");
const { getBadgeTotal } = require("../utils/badge");'''
assert old_require2 in content, "appointments.js REQUIRE ANCHOR NOT FOUND"
content = content.replace(old_require2, new_require2, 1)

old_fn = '''async function bumpNotificationBadge(Model, id) {
  try {
    const updated = await Model.findByIdAndUpdate(
      id,
      { $inc: { unreadNotifications: 1 } },
      { new: true }
    );
    return updated?.unreadNotifications || 1;
  } catch (e) {
    console.error("Failed to bump notification badge:", e);
    return undefined;
  }
}'''
new_fn = '''async function bumpNotificationBadge(Model, id) {
  try {
    await Model.findByIdAndUpdate(id, { $inc: { unreadNotifications: 1 } });
    return await getBadgeTotal(id);
  } catch (e) {
    console.error("Failed to bump notification badge:", e);
    return undefined;
  }
}'''
assert old_fn in content, "appointments.js FUNCTION ANCHOR NOT FOUND"
content = content.replace(old_fn, new_fn, 1)

if content == original:
    print("NO CHANGES MADE to appointments.js")
    sys.exit(1)
with open(path, "w") as f:
    f.write(content)
print("appointments.js patched: appointment push badge now uses combined total.")

print("All badge math fixes applied.")
