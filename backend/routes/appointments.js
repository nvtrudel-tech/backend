const express = require("express");
const Appointment = require("../models/Appointment");
const Worker = require("../models/Worker"); // Import Worker model
const User = require("../models/User"); // Import User model
const router = express.Router();

// --- Helper function to send push notifications ---
const sendPushNotification = async (expoPushToken, title, body) => {
  // Check if the token is valid
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken[')) {
    return console.log(`Invalid or missing push token: ${expoPushToken}. Cannot send notification.`);
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: { screen: 'home' }, // Example: data to deep-link in the app
  };

  try {
    // Use the official Expo push notification endpoint
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    console.log(`Push notification sent successfully to ${expoPushToken}.`);
  } catch (error) {
    console.error("Error sending push notification:", error);
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
// This route constructs the detailed notification body for the worker
router.post("/", async (req, res) => {
  try {
    const { customer, worker, service, date, address, description } = req.body;
    
    // Check for all required fields
    if (!customer || !worker || !service || !date || !address || !description) {
      return res.status(400).json({ msg: "Please provide all required fields." });
    }

    // Find the worker *before* creating the appointment
    const bookedWorker = await Worker.findById(worker).select('expoPushToken name');
    
    if (!bookedWorker) {
      return res.status(404).json({ msg: "Worker not found." });
    }
    
    // Create and save the new appointment (status defaults to 'pending')
    const appointment = new Appointment({ 
      customer, worker, service, date, address, description 
    });
    await appointment.save();

    // --- Send detailed notification logic to worker on new booking ---
    try {
      // Find the customer who booked (to get their name)
      const bookingCustomer = await User.findById(customer).select('name');
      
      // Check if the worker has a token
      if (bookedWorker.expoPushToken) {
        const customerName = bookingCustomer?.name || 'A Customer';

        // 1. Format the date and time clearly
        const appointmentDate = new Date(date).toLocaleDateString();
        const appointmentTime = new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // 2. Construct the detailed notification body using newlines for clarity
        const notificationBody = 
`Customer: ${customerName}
Service: ${service}
Date: ${appointmentDate} at ${appointmentTime}
Address: ${address}
Job Description: ${description}`;

        // Send notification to the worker
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
    res.status(500).json({ msg: "Error creating appointment", error: err.message });
  }
});

// ✅ Update appointment (Handles status, date, AND workerPrice)
router.put("/:id", async (req, res) => {
  try {
    const { status, date, workerPrice } = req.body; 
    
    if (!status) {
       return res.status(400).json({ msg: "Status is required." });
    }
    
    // Fetch the *current* appointment status before updating
    const oldAppointment = await Appointment.findById(req.params.id).select('status');
    const oldStatus = oldAppointment ? oldAppointment.status : null;

    const updateFields = { status };
    // Only update date/price if provided (used by the Worker Dashboard or Customer App)
    if (date) updateFields.date = date; 
    // IMPORTANT: If status is being set back to 'pending' from 'price_pending' (customer rejected), 
    // we should NOT clear the workerPrice or date, so the worker can review their old proposal.
    if (workerPrice !== undefined) updateFields.workerPrice = workerPrice;
    
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id, 
      { $set: updateFields },
      { new: true }
    ).populate('customer worker'); 
    
    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }
    
    // --- Notification Logic ---
    
    // 1. Notify CUSTOMER when worker changes status to price_pending, en_route, confirmed, completed, cancelled
    try {
      if (appointment.customer && appointment.customer.expoPushToken) {
        let notificationTitle;
        let notificationBody;
        
        if (status === 'price_pending' && oldStatus !== 'price_pending') { // New price proposed by worker
          notificationTitle = `Price Proposed!`;
          notificationBody = `${appointment.worker?.name || 'Your specialist'} has proposed a price of $${appointment.workerPrice} for the ${appointment.service} job scheduled for ${new Date(appointment.date).toLocaleDateString()}. Tap to review and accept.`;
        
        // --- NEW: Handle 'en_route' notification ---
        } else if (status === 'en_route' && oldStatus !== 'en_route') { // Worker is on the way
          notificationTitle = `Your Specialist is On The Way!`;
          notificationBody = `${appointment.worker?.name || 'Your specialist'} is heading to your address for the ${appointment.service} job.`;
        // ---
            
        } else if (status === 'confirmed' && oldStatus !== 'confirmed') { // Status changed to confirmed
          notificationTitle = `Appointment Confirmed!`;
          notificationBody = `Your ${appointment.service} job with ${appointment.worker?.name || 'your specialist'} is confirmed for $${appointment.workerPrice}.`;
        } else if (status === 'completed') {
          notificationTitle = `Job Completed!`;
          notificationBody = `The ${appointment.service} job is complete. Final price: $${appointment.workerPrice}.`;
        } else if (status === 'cancelled') {
           notificationTitle = `Appointment Canceled!`;
           // Check if customer or worker initiated the cancel
           if (oldStatus === 'price_pending' && req.body.workerPrice) {
               // Worker canceled (already handled by other logic, but keeping this safe check)
               notificationBody = `ALERT: ${appointment.worker?.name || 'Your specialist'} has canceled the ${appointment.service} job. Please re-book.`;
           } else {
               // Customer canceled (or initial pending job)
               notificationBody = `Your ${appointment.service} job has been cancelled.`;
           }
        }
        
        if (notificationTitle) {
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
    
    // 2. Notify WORKER when customer makes a decision (status changes FROM price_pending)
    // This handles the customer accepting (confirmed) or rejecting/countering (pending) or cancelling.
    if (appointment.worker && appointment.worker.expoPushToken && oldStatus === 'price_pending') {
         let workerNotificationTitle;
         let workerNotificationBody;
         
         if (status === 'confirmed') {
             workerNotificationTitle = `Price Accepted! 🎉`;
             workerNotificationBody = `The customer accepted your price of $${appointment.workerPrice}. The job is now confirmed!`;
         } else if (status === 'pending') {
             workerNotificationTitle = `Price Rejected/Countered`;
             workerNotificationBody = `The customer rejected your price proposal for the ${appointment.service} job. Review the details to send a new proposal.`;
         } else if (status === 'cancelled') {
             workerNotificationTitle = `Job Canceled By Customer 😥`;
             workerNotificationBody = `The customer decided to cancel the ${appointment.service} job during the negotiation phase.`;
         }
         
         if (workerNotificationTitle) {
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
    
    // --- NEW 3. Notify WORKER when customer changes a CONFIRMED job ---
    // This handles the customer requesting reschedule (pending) or cancelling.
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
      // --- FIX: Corrected 4TAM to 404 ---
      return res.status(404).json({ msg: "Appointment not found" });
    }
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting appointment", error: err.message });
  }
});

module.exports = router;

