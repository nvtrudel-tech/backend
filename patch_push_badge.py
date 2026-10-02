import sys

path = "backend/index.js"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Update sendPushNotification to accept a badge count and Android-required fields
old_fn = '''async function sendPushNotification(token, message, senderName = "New Message") {
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
    };'''
new_fn = '''async function sendPushNotification(token, message, senderName = "New Message", badge) {
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
      priority: "high",
      channelId: "default",
      data: {
        type: "chat",
      },
    };

    if (typeof badge === "number") {
      payload.badge = badge;
    }'''
assert old_fn in content, "SEND FUNCTION ANCHOR NOT FOUND"
content = content.replace(old_fn, new_fn, 1)

# 2. Compute the receiver's unread count and pass it as the badge when sending
old_call = '''      const receiverToken = receiverDoc?.expoPushToken || null;
      const senderName =
        typeof populatedMessage?.sender === "object" && populatedMessage?.sender?.name
          ? populatedMessage.sender.name
          : "New Message";

      console.log("🔔 receiver token:", receiverToken || "none");

      if (receiverToken) {
        await sendPushNotification(receiverToken, lastMessagePreview, senderName);
      } else {
        console.log("❌ No valid receiver token found");
      }'''
new_call = '''      const receiverToken = receiverDoc?.expoPushToken || null;
      const senderName =
        typeof populatedMessage?.sender === "object" && populatedMessage?.sender?.name
          ? populatedMessage.sender.name
          : "New Message";

      console.log("🔔 receiver token:", receiverToken || "none");

      if (receiverToken) {
        const unreadBadgeCount = await Message.countDocuments({
          receiver,
          readBy: { $ne: receiver },
        });
        await sendPushNotification(receiverToken, lastMessagePreview, senderName, unreadBadgeCount);
      } else {
        console.log("❌ No valid receiver token found");
      }'''
assert old_call in content, "CALL SITE ANCHOR NOT FOUND"
content = content.replace(old_call, new_call, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Backend patched: Android priority/channel fields + badge count added to push payload.")
