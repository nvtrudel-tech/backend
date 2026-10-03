import sys, os

changed_any = False

# 1. User.js - add unreadNotifications field
path = "backend/models/User.js"
with open(path, "r") as f:
    content = f.read()
old = '''    // Field for push notifications
    expoPushToken: { type: String },'''
new = '''    // Field for push notifications
    expoPushToken: { type: String },
    // Counts appointment-related pushes sent while the app wasn't open/viewed
    unreadNotifications: { type: Number, default: 0 },'''
assert old in content, "User.js ANCHOR NOT FOUND"
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("User.js patched.")

# 2. Worker.js - add unreadNotifications field
path = "backend/models/Worker.js"
with open(path, "r") as f:
    content = f.read()
old = '''    // --- Push Token (Merged) ---
    expoPushToken: { 
      type: String,
      default: null, // (safer default)
    },'''
new = '''    // --- Push Token (Merged) ---
    expoPushToken: { 
      type: String,
      default: null, // (safer default)
    },

    // Counts appointment-related pushes sent while the app wasn't open/viewed
    unreadNotifications: { type: Number, default: 0 },'''
assert old in content, "Worker.js ANCHOR NOT FOUND"
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("Worker.js patched.")

# 3. New routes/notifications.js file
notif_route_content = '''const express = require("express");
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
'''
with open("backend/routes/notifications.js", "w") as f:
    f.write(notif_route_content)
print("backend/routes/notifications.js created.")

# 4. index.js - mount the new route
path = "backend/index.js"
with open(path, "r") as f:
    content = f.read()
old = '''app.use("/api/timeclock", require("./routes/timeclock"));'''
new = '''app.use("/api/timeclock", require("./routes/timeclock"));
app.use("/api/notifications", require("./routes/notifications"));'''
assert old in content, "index.js ANCHOR NOT FOUND"
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("index.js patched: notifications route mounted.")

# 5. appointments.js - add helper, extend sendPushNotification, wire into all 4 call sites
path = "backend/routes/appointments.js"
with open(path, "r") as f:
    content = f.read()
original = content

# 5a. sendPushNotification signature + badge field
old = '''const sendPushNotification = async (expoPushToken, title, body) => {
  // Use the SDK's built-in validator
  if (!Expo.isExpoPushToken(expoPushToken)) {
    return console.log(`Invalid push token: ${expoPushToken}. Cannot send notification.`);
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high',
    channelId: 'default',
    data: { screen: 'home' }, 
  };'''
new = '''const sendPushNotification = async (expoPushToken, title, body, badge) => {
  // Use the SDK's built-in validator
  if (!Expo.isExpoPushToken(expoPushToken)) {
    return console.log(`Invalid push token: ${expoPushToken}. Cannot send notification.`);
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high',
    channelId: 'default',
    data: { screen: 'home' }, 
  };

  if (typeof badge === 'number') {
    message.badge = badge;
  }'''
assert old in content, "sendPushNotification signature ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

# 5b. add bumpNotificationBadge helper right after the function ends
old_end = '''  } catch (error) {
    console.error("Error sending push notification with SDK:", error);
  }
};
// ---'''
new_end = '''  } catch (error) {
    console.error("Error sending push notification with SDK:", error);
  }
};

async function bumpNotificationBadge(Model, id) {
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
}
// ---'''
assert old_end in content, "helper insertion ANCHOR NOT FOUND"
content = content.replace(old_end, new_end, 1)

# 5c. Call site 1: new booking -> worker
old_call1 = '''        // This call will now use the new SDK function
        await sendPushNotification(
          bookedWorker.expoPushToken,
          `NEW BOOKING: ${service} Job (Pending Price)`, 
          notificationBody 
        );'''
new_call1 = '''        // This call will now use the new SDK function
        const workerBookingBadge = await bumpNotificationBadge(Worker, bookedWorker._id);
        await sendPushNotification(
          bookedWorker.expoPushToken,
          `NEW BOOKING: ${service} Job (Pending Price)`, 
          notificationBody,
          workerBookingBadge
        );'''
assert old_call1 in content, "call site 1 ANCHOR NOT FOUND"
content = content.replace(old_call1, new_call1, 1)

# 5d. Call site 2: customer status update
old_call2 = '''        if (notificationTitle) {
           await sendPushNotification(
              appointment.customer.expoPushToken,
              notificationTitle,
              notificationBody
           );
        }'''
new_call2 = '''        if (notificationTitle) {
           const customerBadge = await bumpNotificationBadge(User, appointment.customer._id);
           await sendPushNotification(
              appointment.customer.expoPushToken,
              notificationTitle,
              notificationBody,
              customerBadge
           );
        }'''
assert old_call2 in content, "call site 2 ANCHOR NOT FOUND"
content = content.replace(old_call2, new_call2, 1)

# 5e. Call sites 3 & 4: worker notifications (identical block, appears twice - replace all)
old_call34 = '''         if (workerNotificationTitle) {
             try {
                  await sendPushNotification(
                      appointment.worker.expoPushToken,
                      workerNotificationTitle,
                      workerNotificationBody
                  );
             } catch (e) {
                 console.error("Failed to send status update notification to worker:", e);
             }
         }'''
new_call34 = '''         if (workerNotificationTitle) {
             try {
                  const workerBadge = await bumpNotificationBadge(Worker, appointment.worker._id);
                  await sendPushNotification(
                      appointment.worker.expoPushToken,
                      workerNotificationTitle,
                      workerNotificationBody,
                      workerBadge
                  );
             } catch (e) {
                 console.error("Failed to send status update notification to worker:", e);
             }
         }'''
count34 = content.count(old_call34)
assert count34 == 2, f"expected 2 occurrences of call sites 3&4, found {count34}"
content = content.replace(old_call34, new_call34)

if content == original:
    print("NO CHANGES MADE to appointments.js")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)
print("appointments.js patched: badge bumping wired into all 4 push call sites.")

print("All backend changes applied successfully.")
