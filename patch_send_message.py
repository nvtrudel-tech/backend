import sys

path = "backend/index.js"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''      const { appointmentId, senderId, receiverId, text } = payload;

      if (!appointmentId || !senderId || !receiverId || !text || !text.trim()) {
        return callback?.({ ok: false, message: "Missing required fields" });
      }'''
new = '''      const { appointmentId, senderId, receiverId, text, imageBase64 } = payload;
      const trimmedText = (text || "").trim();

      if (!appointmentId || !senderId || !receiverId || (!trimmedText && !imageBase64)) {
        return callback?.({ ok: false, message: "Missing required fields" });
      }'''
assert old in content, "ANCHOR 1 NOT FOUND"
content = content.replace(old, new, 1)

old2 = '''      console.log("📩 send_message payload:", {
        appointmentId,
        sender,
        receiver,
        text: text.trim(),
      });'''
new2 = '''      console.log("📩 send_message payload:", {
        appointmentId,
        sender,
        receiver,
        text: trimmedText,
        hasImage: !!imageBase64,
      });'''
assert old2 in content, "ANCHOR 2 NOT FOUND"
content = content.replace(old2, new2, 1)

old3 = '''      if (!conversation) {
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
      await conversation.save();'''
new3 = '''      const lastMessagePreview = trimmedText || "📷 Photo";

      if (!conversation) {
        conversation = await Conversation.create({
          appointment: appointment._id,
          customer: customerId,
          worker: workerId,
          lastMessage: lastMessagePreview,
          lastMessageAt: new Date(),
        });
      }

      const newMessage = await Message.create({
        conversation: conversation._id,
        appointment: appointmentId,
        sender: sender,
        receiver: receiver,
        text: trimmedText,
        imageBase64: imageBase64 || null,
        readBy: [sender],
      });

      conversation.lastMessage = lastMessagePreview;
      conversation.lastMessageAt = new Date();
      await conversation.save();'''
assert old3 in content, "ANCHOR 3 NOT FOUND"
content = content.replace(old3, new3, 1)

old4 = '''      if (receiverToken) {
        await sendPushNotification(receiverToken, text.trim(), senderName);
      } else {'''
new4 = '''      if (receiverToken) {
        await sendPushNotification(receiverToken, lastMessagePreview, senderName);
      } else {'''
assert old4 in content, "ANCHOR 4 NOT FOUND"
content = content.replace(old4, new4, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("send_message handler patched for image support.")
