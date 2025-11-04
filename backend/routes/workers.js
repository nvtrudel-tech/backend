const express = require("express");
const Worker = require("../models/Worker"); // Adjust path as needed
const router = express.Router();

// --- SAVE WORKER PUSH TOKEN ---
// This matches the call from your 'worker.js' (worker app)
router.post("/save-push-token", async (req, res) => {
  const { workerId, token } = req.body;

  if (!workerId) {
    return res.status(400).json({ msg: "Worker ID is required" });
  }

  try {
    // Find the worker and update their token
    // Send null to clear the token (on logout)
    const updatedWorker = await Worker.findByIdAndUpdate(
      workerId,
      { expoPushToken: token || null },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ msg: "Worker not found" });
    }

    console.log(`Updated push token for WORKER ${workerId}`); // Server log
    res.status(200).json({ success: true, msg: "Token saved" });
  } catch (err) {
    console.error("Save worker token error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// --- GET ALL WORKERS ---
// (Your worker app fetches this on init)
// This route will now return the 'currentLocation' for all workers
router.get("/", async (req, res) => {
  try {
    const workers = await Worker.find({});
    // The 'currentLocation' field will be included for each worker
    res.status(200).json(workers);
  } catch (err) {
    console.error("Get workers error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// --- UPDATE WORKER PROFILE (MODIFIED) ---
// (Called from 'handleSaveProfile' in worker.js)
router.put("/:id", async (req, res) => {
  try {
    const workerId = req.params.id;
    const updateData = req.body;

    // --- NEW: Check for and reformat location data ---
    // The client sends { currentLocation: { latitude: X, longitude: Y } }
    // We must convert it to GeoJSON for the '2dsphere' index
    if (updateData.currentLocation && 
        updateData.currentLocation.latitude != null && 
        updateData.currentLocation.longitude != null) {
          
      updateData.currentLocation = {
        type: 'Point',
        coordinates: [
          updateData.currentLocation.longitude, // Lng first
          updateData.currentLocation.latitude  // Lat second
        ]
      };
      console.log(`Reformatted location for WORKER ${workerId}`);
    }
    // --- End location formatting ---

    // This route will now accept 'profileImageBase64'
    // and the correctly formatted 'currentLocation'
    const updatedWorker = await Worker.findByIdAndUpdate(
      workerId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(444).json({ msg: "Worker not found" });
    }
    console.log(`Updated profile for WORKER ${workerId}`);
    res.status(200).json(updatedWorker);
  } catch (err) {
    console.error("Update worker profile error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// --- UPDATE WORKER LOCATION ---
// This route also works if you want to update *only* the location
router.post("/:id/update-location", async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  if (latitude == null || longitude == null) {
    return res.status(400).json({ msg: "Latitude and longitude are required" });
  }

  try {
    // Format the update for GeoJSON
    const locationUpdate = {
      currentLocation: {
        type: "Point",
        coordinates: [longitude, latitude], // IMPORTANT: [longitude, latitude]
      },
    };

    const updatedWorker = await Worker.findByIdAndUpdate(
      id,
      { $set: locationUpdate },
      { new: true }
    );

    if (!updatedWorker) {
      return res.status(404).json({ msg: "Worker not found" });
    }

    console.log(`Updated location for WORKER ${id}`);
    res.status(200).json(updatedWorker);
  } catch (err) {
    console.error("Update location error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// --- CLOCK IN ---
// (Called from 'handleClockToggle' in worker.js)
router.post("/:id/clock-in", async (req, res) => {
  try {
    const workerId = req.params.id;
    const update = {
      "currentClock.clockedIn": true,
      "currentClock.clockInTime": new Date(),
    };
    const worker = await Worker.findByIdAndUpdate(workerId, update, { new: true });
    if (!worker) return res.status(404).json({ msg: "Worker not found" });

    console.log(`WORKER ${workerId} clocked IN`);
    res.status(200).json(worker);
  } catch (err) {
    console.error("Clock-in error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// --- CLOCK OUT ---
// (Called from 'handleClockToggle' in worker.js)
router.post("/:id/clock-out", async (req, res) => {
  try {
    const workerId = req.params.id;

    // Find the worker to calculate hours
    const worker = await Worker.findById(workerId);
    if (!worker || !worker.currentClock.clockInTime) {
      return res.status(400).json({ msg: "Worker not clocked in or not found." });
    }

    const clockInTime = new Date(worker.currentClock.clockInTime);
    const clockOutTime = new Date();
    
    // You can add logic here to calculate totalHoursToday if needed
    
    const update = {
      "currentClock.clockedIn": false,
      "currentClock.clockOutTime": clockOutTime,
    };

    const updatedWorker = await Worker.findByIdAndUpdate(workerId, update, { new: true });

    console.log(`WORKER ${workerId} clocked OUT`);
    res.status(200).json(updatedWorker);
  } catch (err) {
    console.error("Clock-out error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});


module.exports = router;

