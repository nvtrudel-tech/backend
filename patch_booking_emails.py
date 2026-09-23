import sys

path = "backend/routes/appointments.js"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Add the mailer require near the top
old_require = '''const { Expo } = require('expo-server-sdk'); // --- IMPORT THE SDK ---'''
new_require = old_require + '''
const { sendBookingConfirmationEmails } = require("../utils/mailer");'''
assert old_require in content, "REQUIRE ANCHOR NOT FOUND"
content = content.replace(old_require, new_require, 1)

# 2. Insert the email trigger right after the price_pending-guarded worker
#    push notification block, before the "Notify WORKER (if customer cancels/reschedules...)" section
old_anchor = '''         if (workerNotificationTitle) {
             try {
                  await sendPushNotification(
                      appointment.worker.expoPushToken,
                      workerNotificationTitle,
                      workerNotificationBody
                  );
             } catch (e) {
                 console.error("Failed to send status update notification to worker:", e);
             }
         }
    }
    
    // 3. Notify WORKER (if customer cancels/reschedules a confirmed job)'''
new_anchor = '''         if (workerNotificationTitle) {
             try {
                  await sendPushNotification(
                      appointment.worker.expoPushToken,
                      workerNotificationTitle,
                      workerNotificationBody
                  );
             } catch (e) {
                 console.error("Failed to send status update notification to worker:", e);
             }
         }
    }

    // Send booking confirmation emails to both parties when price is accepted
    if (status === 'confirmed' && oldStatus === 'price_pending') {
        try {
            await sendBookingConfirmationEmails(appointment);
        } catch (e) {
            console.error("Failed to send booking confirmation emails:", e);
        }
    }
    
    // 3. Notify WORKER (if customer cancels/reschedules a confirmed job)'''
assert old_anchor in content, "ANCHOR NOT FOUND"
content = content.replace(old_anchor, new_anchor, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Appointments route patched to send booking confirmation emails.")
