const express = require("express");
const Appointment = require("../models/Appointment");
const Worker = require("../models/Worker"); // Import Worker model
const User = require("../models/User"); // Import User model
const router = express.Router();
const { Expo } = require('expo-server-sdk'); // --- IMPORT THE SDK ---

// --- Helper function to send push notifications (NEW VERSION) ---
// Create a new Expo client
const expo = new Expo();

const sendPushNotification = async (expoPushToken, title, body) => {
  // Use the SDK's built-in validator
  if (!Expo.isExpoPushToken(expoPushToken)) {
    return console.log(`Invalid push token: ${expoPushToken}. Cannot send notification.`);
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: { screen: 'home' }, 
  };

  try {
    // Send the notification using the SDK
    // sendPushNotificationsAsync expects an array of messages
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log(`Push notification ticket (1st chunk):`, ticket);
    // You can add logic here to check for errors in the 'ticket' response
    // For example, ticket[0].status === 'error'
  } catch (error) {
    console.error("Error sending push notification with SDK:", error);
  }
};
// ---

// ✅ Get all appointments
router.get("/", async (req, res) => {
  try {
    const appointments = await Appointment.find().populate("customer worker");
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching appointments", error: err.message });
  }
});

// ✅ Create appointment
router.post("/", async (req, res) => {
  try {
    const { customer, worker, service, date, address, description } = req.body;
    
    if (!customer || !worker || !service || !date || !address || !description) {
      return res.status(400).json({ msg: "Please provide all required fields." });
    }

    const bookedWorker = await Worker.findById(worker).select('expoPushToken name');
    
    if (!bookedWorker) {
      return res.status(404).json({ msg: "Worker not found." });
    }
    
    const appointment = new Appointment({ 
      customer, worker, service, date, address, description 
    });
    await appointment.save();

    // --- Send detailed notification logic to worker on new booking ---
    try {
      const bookingCustomer = await User.findById(customer).select('name');
      if (bookedWorker.expoPushToken) {
        const customerName = bookingCustomer?.name || 'A Customer';
        const appointmentDate = new Date(date).toLocaleDateString();
        const appointmentTime = new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const notificationBody = 
`Customer: ${customerName}
Service: ${service}
Date: ${appointmentDate} at ${appointmentTime}
Address: ${address}
Job Description: ${description}`;

        // This call will now use the new SDK function
        await sendPushNotification(
          bookedWorker.expoPushToken,
          `NEW BOOKING: ${service} Job (Pending Price)`, 
          notificationBody 
        );
      } else {
        console.log(`Worker ${bookedWorker?.name || worker} does not have a push token saved. (Appointment: ${appointment._id})`);
      }
    } catch (notifyError) {
      console.error("Failed to send notification:", notifyError);
    }
    // ---

    res.status(201).json(appointment);
  } catch (err) {
    console.error("Create appointment error:", err);
    // --- MODIFIED: Fixed typo 5.00 -> 500 ---
    res.status(500).json({ msg: "Error creating appointment", error: err.message });
  }
});

// --- MODIFIED: Update appointment (Handles new priceBreakdown) ---
router.put("/:id", async (req, res) => {
  try {
    // We now expect 'priceBreakdown' (an array) instead of 'workerPrice'
    const { status, date, priceBreakdown } = req.body; 
    
    if (!status) {
       return res.status(400).json({ msg: "Status is required." });
    }
    
    const oldAppointment = await Appointment.findById(req.params.id).select('status');
    const oldStatus = oldAppointment ? oldAppointment.status : null;

    const updateFields = { status };
    if (date) updateFields.date = date; 
    
    // --- MODIFIED PRICE LOGIC (Copied from your code) ---
    let newTotalPrice = 0; // Default to 0

    if (priceBreakdown && Array.isArray(priceBreakdown) && priceBreakdown.length > 0) {
      
      const cleanPriceBreakdown = priceBreakdown
        .map(item => ({
          item: String(item.item || '').trim(),
          price: parseFloat(item.price) || 0 // Coerce NaN/"" to 0
        }))
        .filter(item => item.item && item.price > 0); // Filter out invalid/empty items

      // Calculate total *only* from the clean list
      newTotalPrice = cleanPriceBreakdown.reduce((acc, item) => acc + item.price, 0);
      
      if (cleanPriceBreakdown.length === 0 && status === 'price_pending') {
        return res.status(400).json({ msg: "A price breakdown with valid items and positive prices is required." });
      }

      updateFields.priceBreakdown = cleanPriceBreakdown;
      
    } else if (status === 'price_pending') {
      // Worker is submitting a price, but sent no breakdown array
      return res.status(400).json({ msg: "A price breakdown is required to propose a price." });
    }
    
    // --- THIS IS THE CRITICAL FIX (Copied from your code) ---
    // Always set totalPrice and workerPrice, even if they are 0.
    // This prevents "null" from being saved to the database.
    updateFields.totalPrice = newTotalPrice;
    updateFields.workerPrice = newTotalPrice; 
    // --- END FIX ---

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id, 
      { $set: updateFields },
      { new: true }
    ).populate('customer worker'); 
    
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }
    
    // --- Notification Logic (MODIFIED to use totalPrice) ---
    
    // 1. Notify CUSTOMER
    try {
      if (appointment.customer && appointment.customer.expoPushToken) {
        let notificationTitle;
        let notificationBody;
        
        if (status === 'price_pending' && oldStatus !== 'price_pending') { 
          notificationTitle = `Price Proposed!`;
          // Use the new totalPrice
          notificationBody = `${appointment.worker?.name || 'Your specialist'} has proposed a price of $${appointment.totalPrice.toFixed(2)} for the ${appointment.service} job. Tap to review the breakdown.`;
        
        } else if (status === 'en_route' && oldStatus !== 'en_route') {
          notificationTitle = `Your Specialist is On The Way!`;
          notificationBody = `${appointment.worker?.name || 'Your specialist'} is heading to your address for the ${appointment.service} job.`;
            
        } else if (status === 'confirmed' && oldStatus !== 'confirmed') { 
          notificationTitle = `Appointment Confirmed!`;
          // Use the new totalPrice
          notificationBody = `Your ${appointment.service} job with ${appointment.worker?.name || 'your specialist'} is confirmed for $${appointment.totalPrice.toFixed(2)}.`;
        } else if (status === 'completed') {
          notificationTitle = `Job Completed!`;
          // Use the new totalPrice
          notificationBody = `The ${appointment.service} job is complete. Final price: $${appointment.totalPrice.toFixed(2)}.`;
        } else if (status === 'cancelled') {
           notificationTitle = `Appointment Canceled!`;
           notificationBody = `Your ${appointment.service} job has been cancelled.`;
        }
        
        if (notificationTitle) {
           // This call will now use the new SDK function
           await sendPushNotification(
              appointment.customer.expoPushToken,
              notificationTitle,
              notificationBody
           );
        }
      } else {
        console.log(`Customer ${appointment.customer?._id} does not have a push token.`);
      }
    } catch (notifyError) {
       console.error("Failed to send status update notification to customer:", notifyError);
    }
    
    // 2. Notify WORKER
    if (appointment.worker && appointment.worker.expoPushToken && oldStatus === 'price_pending') {
         let workerNotificationTitle;
         let workerNotificationBody;
         
         if (status === 'confirmed') {
             workerNotificationTitle = `Price Accepted! 🎉`;
             // Use the new totalPrice
             workerNotificationBody = `The customer accepted your price of $${appointment.totalPrice.toFixed(2)}. The job is now confirmed!`;
         } else if (status === 'pending') {
             workerNotificationTitle = `Price Rejected/Countered`;
             workerNotificationBody = `The customer rejected your price proposal for the ${appointment.service} job. Review the details to send a new proposal.`;
         } else if (status === 'cancelled') {
             workerNotificationTitle = `Job Canceled By Customer 😥`;
             workerNotificationBody = `The customer decided to cancel the ${appointment.service} job during the negotiation phase.`;
         }
         
         if (workerNotificationTitle) {
             try {
                  // This call will now use the new SDK function
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
    
    // 3. Notify WORKER (if customer cancels/reschedules a confirmed job)
    if (appointment.worker && appointment.worker.expoPushToken && oldStatus === 'confirmed') {
         let workerNotificationTitle;
         let workerNotificationBody;
         
         if (status === 'pending') { // Customer requested reschedule
             workerNotificationTitle = `Reschedule Request`;
             workerNotificationBody = `The customer has requested a reschedule for the ${appointment.service} job. Please review and propose a new time/price.`;
         } else if (status === 'cancelled') { // Customer cancelled a confirmed job
             workerNotificationTitle = `Job Canceled By Customer 😥`;
             workerNotificationBody = `The customer has CANCELED the confirmed ${appointment.service} job.`;
         }
         
         if (workerNotificationTitle) {
             try {
                  // This call will now use the new SDK function
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
    // --- End Notification Logic ---

    res.json(appointment);
  } catch (err) {
    console.error("Update appointment error:", err);
    res.status(500).json({ msg: "Error updating appointment", error: err.message });
  }
});

// ✅ Delete appointment
router.delete("/:id", async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting appointment", error: err.message });
  }
});

module.exports = router;