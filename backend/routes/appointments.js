const express = require("express");
const Appointment = require("../models/Appointment");
const Worker = require("../models/Worker"); // Import Worker model
const User = require("../models/User"); // Import User model
const router = express.Router();
const { Expo } = require('expo-server-sdk'); // --- IMPORT THE SDK ---
const { sendBookingConfirmationEmails } = require("../utils/mailer");
const { getBadgeTotal } = require("../utils/badge");
const {
  requireAuth,
  requireEmployer,
} = require("../middleware/auth");

// --- Helper function to send push notifications (NEW VERSION) ---
// Create a new Expo client
const expo = new Expo();

const sendPushNotification = async (expoPushToken, title, body, badge) => {
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
  }

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

async function bumpNotificationBadge(Model, id) {
  try {
    await Model.findByIdAndUpdate(id, { $inc: { unreadNotifications: 1 } });
    return await getBadgeTotal(id);
  } catch (e) {
    console.error("Failed to bump notification badge:", e);
    return undefined;
  }
}


//
// EMPLOYER DASHBOARD: LIST JOBS
// GET /api/appointments/admin
// Optional query: ?archived=true&status=completed&service=Electrician
//
router.get("/admin", requireAuth, requireEmployer, async (req, res) => {
  try {
    const filter = {
      isArchived: req.query.archived === "true",
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.service) {
      filter.service = req.query.service;
    }

    const appointments = await Appointment.find(filter)
      .populate("customer", "name email phone")
      .populate("worker", "name email phone skills employerId")
      .sort({ createdAt: -1 })
      .limit(500);

    return res.json(appointments);
  } catch (err) {
    console.error("Employer appointments error:", err);
    return res.status(500).json({
      msg: "Error fetching employer appointments",
    });
  }
});

//
// EMPLOYER DISPATCH: assign/reassign a job to a company employee or an independent specialist.
// PATCH /api/appointments/:id/assign  { "workerId": "..." }
router.patch("/:id/assign", requireAuth, requireEmployer, async (req, res) => {
  try {
    const { workerId } = req.body || {};
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(workerId || "")) {
      return res.status(400).json({ msg: "Valid appointment ID and workerId are required." });
    }

    console.log("[ASSIGN DEBUG] Appointment ID:", req.params.id);
    console.log("[ASSIGN DEBUG] Requested worker ID:", workerId);
    console.log("[ASSIGN DEBUG] Employer user ID:", req.user._id);  


    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ msg: "Appointment not found." });

    console.log("[ASSIGN DEBUG] Appointment found:", !!appointment);

    if (["completed", "cancelled"].includes(String(appointment.status || "").toLowerCase())) {
      return res.status(409).json({ msg: "Completed or cancelled jobs cannot be assigned." });
    }
    const worker = await Worker.findById(workerId).select("name email skills employerId expoPushToken");
    if (!worker) return res.status(404).json({ msg: "Specialist not found." });

    console.log("[ASSIGN DEBUG] Worker found:", !!worker);

    const service = String(appointment.service || "").trim().toLowerCase();
    const skills = (worker.skills || []).map((skill) => String(skill).trim().toLowerCase());
    if (skills.length && !skills.includes(service)) {
      return res.status(400).json({ msg: "This specialist does not list the job's service as a skill." });
    }

    const assignmentType = worker.employerId && worker.employerId.toString() === req.user._id.toString() ? "employee" : "independent";
    if (worker.employerId && assignmentType !== "employee") {
      return res.status(403).json({ msg: "This specialist belongs to another employer." });
    }

    const now = new Date();
    if (appointment.worker) {
      appointment.dispatch = appointment.dispatch || {};
      appointment.dispatch.history = appointment.dispatch.history || [];
      appointment.dispatch.history.push({
        worker: appointment.worker, assignedBy: req.user._id, assignedAt: now,
        assignmentType: appointment.dispatch.assignmentType || "independent",
      });
    }
    appointment.worker = worker._id;
    appointment.dispatch = appointment.dispatch || {};
    appointment.dispatch.assignedBy = req.user._id;
    appointment.dispatch.assignedAt = now;
    appointment.dispatch.assignmentType = assignmentType;
    await appointment.save();

    try {
      if (worker.expoPushToken) {
        const badge = await bumpNotificationBadge(Worker, worker._id);
        await sendPushNotification(worker.expoPushToken, "Job assigned to you", `${appointment.service || "A job"} has been assigned to you. Open Connexions to review the details.`, badge);
      }
    } catch (notificationError) {
      console.error("Dispatch notification failed:", notificationError);
    }

    const populated = await Appointment.findById(appointment._id)
      .populate("customer", "name email phone")
      .populate("worker", "name email phone skills employerId");
    return res.json({ success: true, msg: "Job assigned successfully.", appointment: populated });
  } catch (err) {
    console.error("Assign appointment error:", err);
    return res.status(500).json({ msg: "Unable to assign this job." });
  }
});

//
// EMPLOYER DASHBOARD: ARCHIVE A JOB
// PATCH /api/appointments/:id/archive
//
router.patch(
  "/:id/archive",
  requireAuth,
  requireEmployer,
  async (req, res) => {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
          },
        },
        { new: true, runValidators: true }
      );

      if (!appointment) {
        return res.status(404).json({
          msg: "Appointment not found",
        });
      }

      return res.json({
        success: true,
        msg: "Appointment archived",
        appointment,
      });
    } catch (err) {
      console.error("Archive appointment error:", err);
      return res.status(500).json({
        msg: "Error archiving appointment",
      });
    }
  }
);

//
// EMPLOYER DASHBOARD: RESTORE A JOB
// PATCH /api/appointments/:id/restore
//
router.patch(
  "/:id/restore",
  requireAuth,
  requireEmployer,
  async (req, res) => {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            isArchived: false,
            archivedAt: null,
          },
        },
        { new: true, runValidators: true }
      );

      if (!appointment) {
        return res.status(404).json({
          msg: "Appointment not found",
        });
      }

      return res.json({
        success: true,
        msg: "Appointment restored",
        appointment,
      });
    } catch (err) {
      console.error("Restore appointment error:", err);
      return res.status(500).json({
        msg: "Error restoring appointment",
      });
    }
  }
);

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
        const workerBookingBadge = await bumpNotificationBadge(Worker, bookedWorker._id);
        await sendPushNotification(
          bookedWorker.expoPushToken,
          `NEW BOOKING: ${service} Job (Pending Price)`, 
          notificationBody,
          workerBookingBadge
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

// --- MODIFIED: Update appointment (Handles new priceBreakdown and cancellationReason) ---
router.put("/:id", async (req, res) => {
  try {
    // We now expect 'priceBreakdown' (an array) instead of 'workerPrice'
    // --- ADDED cancellationReason to destructuring ---
    const { status, date, priceBreakdown, cancellationReason } = req.body; 
    
    if (!status) {
       return res.status(400).json({ msg: "Status is required." });
    }
    
    const oldAppointment = await Appointment.findById(req.params.id).select('status');
    const oldStatus = oldAppointment ? oldAppointment.status : null;

    const updateFields = { status };
    if (date) updateFields.date = date; 
    
    // --- NEW: Add cancellationReason to update if provided ---
    if (cancellationReason) {
      updateFields.cancellationReason = cancellationReason;
    }
    // ---

    // --- MODIFIED PRICE LOGIC ---
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
    
    // --- THIS IS THE CRITICAL FIX ---
    // Always set totalPrice and workerPrice, even if they are 0.
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
    
    // --- Notification Logic (MODIFIED to use totalPrice and cancellationReason) ---
    
    // 1. Notify CUSTOMER
    try {
      if (appointment.customer && appointment.customer.expoPushToken) {
        let notificationTitle;
        let notificationBody;
        
        if (status === 'price_pending' && oldStatus !== 'price_pending') { 
          notificationTitle = `Price Proposed!`;
          notificationBody = `${appointment.worker?.name || 'Your specialist'} has proposed a price of $${appointment.totalPrice.toFixed(2)} for the ${appointment.service} job. Tap to review the breakdown.`;
        
        } else if (status === 'en_route' && oldStatus !== 'en_route') {
          notificationTitle = `Your Specialist is On The Way!`;
          notificationBody = `${appointment.worker?.name || 'Your specialist'} is heading to your address for the ${appointment.service} job.`;
            
        } else if (status === 'confirmed' && oldStatus !== 'confirmed') { 
          notificationTitle = `Appointment Confirmed!`;
          notificationBody = `Your ${appointment.service} job with ${appointment.worker?.name || 'your specialist'} is confirmed for $${appointment.totalPrice.toFixed(2)}.`;
        
        } else if (status === 'completed') {
          notificationTitle = `Job Completed!`;
          notificationBody = `The ${appointment.service} job is complete. Final price: $${appointment.totalPrice.toFixed(2)}.`;
        
        } else if (status === 'cancelled') {
           notificationTitle = `Appointment Canceled!`;
           // --- NEW: Include cancellation reason if it exists ---
           if (appointment.cancellationReason) {
             notificationBody = `Your ${appointment.service} job has been cancelled. Reason: ${appointment.cancellationReason}`;
           } else {
             notificationBody = `Your ${appointment.service} job has been cancelled.`;
           }
           // ---
        }
        
        if (notificationTitle) {
           const customerBadge = await bumpNotificationBadge(User, appointment.customer._id);
           await sendPushNotification(
              appointment.customer.expoPushToken,
              notificationTitle,
              notificationBody,
              customerBadge
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
             workerNotificationBody = `The customer accepted your price of $${appointment.totalPrice.toFixed(2)}. The job is now confirmed!`;
         
         } else if (status === 'pending') {
             workerNotificationTitle = `Price Rejected/Countered`;
             workerNotificationBody = `The customer rejected your price proposal for the ${appointment.service} job. Review the details to send a new proposal.`;
         
         } else if (status === 'cancelled') {
             workerNotificationTitle = `Job Canceled By Customer 😥`;
             // --- NEW: Include cancellation reason if it exists ---
             if (appointment.cancellationReason) {
                workerNotificationBody = `The customer decided to cancel the ${appointment.service} job. Reason: ${appointment.cancellationReason}`;
             } else {
                workerNotificationBody = `The customer decided to cancel the ${appointment.service} job during the negotiation phase.`;
             }
             // ---
         }
         
         if (workerNotificationTitle) {
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
    
    // 3. Notify WORKER (if customer cancels/reschedules a confirmed job)
    if (appointment.worker && appointment.worker.expoPushToken && oldStatus === 'confirmed') {
         let workerNotificationTitle;
         let workerNotificationBody;
         
         if (status === 'pending') { // Customer requested reschedule
             workerNotificationTitle = `Reschedule Request`;
             workerNotificationBody = `The customer has requested a reschedule for the ${appointment.service} job. Please review and propose a new time/price.`;
         
         } else if (status === 'cancelled') { // Customer cancelled a confirmed job
             workerNotificationTitle = `Job Canceled By Customer 😥`;
             // --- NEW: Include cancellation reason if it exists ---
             if (appointment.cancellationReason) {
                workerNotificationBody = `The customer has CANCELED the confirmed ${appointment.service} job. Reason: ${appointment.cancellationReason}`;
             } else {
                workerNotificationBody = `The customer has CANCELED the confirmed ${appointment.service} job.`;
             }
             // ---
         }
         
         if (workerNotificationTitle) {
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
         }
    }
    // --- End Notification Logic ---

    res.json(appointment);
  } catch (err) {
    console.error("Update appointment error:", err);
    res.status(500).json({ msg: "Error updating appointment", error: err.message });
  }
});

// Delete appointment — only the customer who owns it can delete it.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        msg: "Appointment not found",
      });
    }

    // Verify that the logged-in user owns this appointment.
    if (appointment.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        msg: "You are not authorized to cancel this appointment.",
      });
    }

    await appointment.deleteOne();

    return res.json({
      msg: "Deleted",
    });
  } catch (err) {
    console.error("Delete appointment error:", err);

    return res.status(500).json({
      msg: "Error deleting appointment",
    });
  }
});

module.exports = router;