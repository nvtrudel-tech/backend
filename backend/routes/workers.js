
const express = require("express");
const mongoose = require("mongoose");
const Worker = require("../models/Worker");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// --------------------------------------------------
// AUTHORIZATION: verify the logged-in user owns
// the worker profile being changed.
// --------------------------------------------------
async function requireOwnWorker(req, res, next) {
  try {
    const workerId = req.params.id || req.body.workerId;

    if (!workerId) {
      return res.status(400).json({ msg: "Worker ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).json({ msg: "Invalid worker ID." });
    }

    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({ msg: "Worker not found." });
    }

    if (
      !worker.authId ||
      worker.authId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        msg: "You are not authorized to access this worker profile.",
      });
    }

    req.worker = worker;
    return next();
  } catch (err) {
    console.error("Worker ownership check error:", err);
    return res.status(500).json({
      msg: "Unable to verify worker ownership.",
    });
  }
}

// --------------------------------------------------
// GET /workers/nearby
// Public: customers can find available specialists.
// Query parameters: longitude, latitude, maxDistance
// maxDistance is in metres.
// --------------------------------------------------
router.get("/nearby", async (req, res) => {
  try {
    const longitude = Number(req.query.longitude);
    const latitude = Number(req.query.latitude);
    const rawMaxDistance = req.query.maxDistance;

    const maxDistance =
      rawMaxDistance === undefined ? 10000 : Number(rawMaxDistance);

    if (
      req.query.longitude === undefined ||
      req.query.latitude === undefined ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(maxDistance) ||
      maxDistance <= 0 ||
      maxDistance > 100000
    ) {
      return res.status(400).json({
        msg: "Valid coordinates and maximum distance are required.",
      });
    }

    const workers = await Worker.find({
      "currentClock.clockedIn": true,
      currentLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistance,
        },
      },
    }).select("-expoPushToken -authId -email");

    return res.status(200).json(workers);
  } catch (err) {
    console.error("Find nearby workers error:", err);
    return res.status(500).json({
      msg: "Unable to find nearby workers.",
    });
  }
});

// --------------------------------------------------
// POST /workers
// Create a worker profile for a logged-in specialist.
// --------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    if (!["specialist", "worker"].includes(req.user.role)) {
      return res.status(403).json({
        msg: "A specialist account is required.",
      });
    }

    const authId = req.user._id;
    const name = String(req.user.name || "").trim();
    const email = String(req.user.email || "").trim().toLowerCase();
    const phone = req.body.phone;

    if (!name) {
      return res.status(400).json({
        msg: "The account must have a name.",
      });
    }

    if (!email) {
      return res.status(400).json({
        msg: "The account must have an email address.",
      });
    }

    if (phone !== undefined && typeof phone !== "string") {
      return res.status(400).json({
        msg: "Phone must be a string.",
      });
    }

    const existing = await Worker.findOne({
      $or: [{ email }, { authId }],
    });

    if (existing) {
      return res.status(409).json({
        msg: "A worker profile already exists for this account or email.",
      });
    }

    const newWorker = new Worker({
      name,
      email,
      phone: phone ? phone.trim() : "",
      authId,
      availability: {
        monday: {
          start: "09:00",
          end: "17:00",
          available: true,
        },
        tuesday: {
          start: "09:00",
          end: "17:00",
          available: true,
        },
        wednesday: {
          start: "09:00",
          end: "17:00",
          available: true,
        },
        thursday: {
          start: "09:00",
          end: "17:00",
          available: true,
        },
        friday: {
          start: "09:00",
          end: "17:00",
          available: true,
        },
        saturday: {
          start: "",
          end: "",
          available: false,
        },
        sunday: {
          start: "",
          end: "",
          available: false,
        },
      },
      currentLocation: {
        type: "Point",
        coordinates: [0, 0],
      },
    });

    await newWorker.save();

    // Do not return account IDs or push tokens.
    const safeWorker = await Worker.findById(newWorker._id).select(
      "-expoPushToken -authId -email"
    );

    return res.status(201).json(safeWorker);
  } catch (err) {
    console.error("Create worker error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        msg: "A worker profile already exists for this account or email.",
      });
    }

    return res.status(500).json({
      success: false,
      msg: "Unable to create worker profile.",
    });
  }
});

// --------------------------------------------------
// POST /workers/save-push-token
// Save a push notification token for the owner's profile.
// Expected body: { workerId, token }
// --------------------------------------------------
router.post(
  "/save-push-token",
  requireAuth,
  requireOwnWorker,
  async (req, res) => {
    try {
      const token = req.body.token;

      if (
        token !== null &&
        token !== undefined &&
        typeof token !== "string"
      ) {
        return res.status(400).json({
          msg: "The push token must be a string or null.",
        });
      }

      req.worker.expoPushToken =
        typeof token === "string" && token.trim() ? token.trim() : null;

      await req.worker.save();

      return res.status(200).json({
        success: true,
        msg: "Token saved.",
      });
    } catch (err) {
      console.error("Save worker token error:", err);

      return res.status(500).json({
        success: false,
        msg: "Unable to save worker token.",
      });
    }
  }
);

// --------------------------------------------------
// GET /workers/employer-roster?service=Electrician
// Employer-only roster: company employees plus independent specialists.
// --------------------------------------------------
router.get("/employer-roster", requireAuth, async (req, res, next) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.user._id).select("isEmployer");
    if (!user || user.isEmployer !== true) {
      return res.status(403).json({ msg: "Employer access required." });
    }
    const filter = { $or: [{ employerId: req.user._id }, { employerId: null }, { employerId: { $exists: false } }] };
    const workers = await Worker.find(filter).select("name email phone skills employerId currentClock.clockedIn").sort({ name: 1 }).lean();
    const service = String(req.query.service || "").trim().toLowerCase();
    const roster = workers.filter((worker) => {
      if (!service) return true;
      return (worker.skills || []).some((skill) => String(skill).trim().toLowerCase() === service);
    }).map((worker) => ({
      _id: worker._id, name: worker.name, email: worker.email, phone: worker.phone, skills: worker.skills || [],
      isEmployee: !!worker.employerId && String(worker.employerId) === String(req.user._id),
      specialistType: worker.employerId && String(worker.employerId) === String(req.user._id) ? "employee" : "independent",
      clockedIn: !!worker.currentClock?.clockedIn,
    }));
    return res.json(roster);
  } catch (err) {
    console.error("Employer roster error:", err);
    return res.status(500).json({ msg: "Unable to retrieve employer roster." });
  }
});

// --------------------------------------------------
// GET /workers
// Return worker profiles for the existing app screens.
// Never expose push tokens, account IDs or email addresses.
// --------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const workers = await Worker.find({}).select(
      "-expoPushToken -authId -email"
    );

    return res.status(200).json(workers);
  } catch (err) {
    console.error("Get workers error:", err);

    return res.status(500).json({
      msg: "Unable to retrieve workers.",
    });
  }
});

// --------------------------------------------------
// PUT /workers/:id
// Update allowed profile fields for the profile owner.
// Protected fields cannot be changed through this endpoint.
// --------------------------------------------------
router.put("/:id", requireAuth, requireOwnWorker, async (req, res) => {
  try {
    const {
      name,
      phone,
      age,
      gender,
      skills,
      maxDistance,
      availability,
      profileImageBase64,
      profileImageUrl,
      currentLocation,
    } = req.body;

    const updateData = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          msg: "Name must be a non-empty string.",
        });
      }

      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          msg: "Phone must be a string.",
        });
      }

      updateData.phone = phone.trim();
    }

    if (age !== undefined) {
      const parsedAge = Number(age);

      if (
        !Number.isInteger(parsedAge) ||
        parsedAge < 13 ||
        parsedAge > 120
      ) {
        return res.status(400).json({
          msg: "Age must be a valid number.",
        });
      }

      updateData.age = parsedAge;
    }

    if (gender !== undefined) {
      const allowedGenders = [
        "Male",
        "Female",
        "Other",
        "Prefer not to say",
      ];

      if (!allowedGenders.includes(gender)) {
        return res.status(400).json({
          msg: "Invalid gender value.",
        });
      }

      updateData.gender = gender;
    }

    if (skills !== undefined) {
      if (
        !Array.isArray(skills) ||
        !skills.every(
          (skill) => typeof skill === "string" && skill.trim()
        )
      ) {
        return res.status(400).json({
          msg: "Skills must be an array of non-empty strings.",
        });
      }

      updateData.skills = skills.map((skill) => skill.trim());
    }

    if (maxDistance !== undefined) {
      const parsedDistance = Number(maxDistance);

      if (
        !Number.isFinite(parsedDistance) ||
        parsedDistance <= 0 ||
        parsedDistance > 500
      ) {
        return res.status(400).json({
          msg: "Maximum distance must be between 1 and 500 km.",
        });
      }

      updateData.maxDistance = parsedDistance;
    }

    if (availability !== undefined) {
      if (
        !availability ||
        typeof availability !== "object" ||
        Array.isArray(availability)
      ) {
        return res.status(400).json({
          msg: "Availability must be an object.",
        });
      }

      updateData.availability = availability;
    }

    if (profileImageBase64 !== undefined) {
      if (
        profileImageBase64 !== null &&
        typeof profileImageBase64 !== "string"
      ) {
        return res.status(400).json({
          msg: "Profile image must be a string or null.",
        });
      }

      updateData.profileImageBase64 = profileImageBase64;
    }

    if (profileImageUrl !== undefined) {
      if (typeof profileImageUrl !== "string") {
        return res.status(400).json({
          msg: "Profile image URL must be a string.",
        });
      }

      updateData.profileImageUrl = profileImageUrl.trim();
    }

    if (currentLocation !== undefined) {
      if (
        !currentLocation ||
        typeof currentLocation !== "object" ||
        Array.isArray(currentLocation) ||
        currentLocation.latitude === undefined ||
        currentLocation.longitude === undefined
      ) {
        return res.status(400).json({
          msg: "A location with latitude and longitude is required.",
        });
      }

      const latitude = Number(currentLocation.latitude);
      const longitude = Number(currentLocation.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          msg: "Invalid latitude or longitude.",
        });
      }

      updateData.currentLocation = {
        type: "Point",
        coordinates: [longitude, latitude],
      };
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        msg: "No valid profile fields were provided.",
      });
    }

    const updatedWorker = await Worker.findByIdAndUpdate(
      req.worker._id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    ).select("-expoPushToken -authId -email");

    if (!updatedWorker) {
      return res.status(404).json({
        msg: "Worker not found.",
      });
    }

    return res.status(200).json(updatedWorker);
  } catch (err) {
    console.error("Update worker profile error:", err);

    return res.status(500).json({
      msg: "Unable to update worker profile.",
    });
  }
});

// --------------------------------------------------
// POST /workers/:id/update-location
// Update the owner's location.
// Expected body: { latitude, longitude }
// --------------------------------------------------
router.post(
  "/:id/update-location",
  requireAuth,
  requireOwnWorker,
  async (req, res) => {
    try {
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);

      if (
        req.body.latitude === undefined ||
        req.body.longitude === undefined ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          msg: "Valid latitude and longitude are required.",
        });
      }

      const updatedWorker = await Worker.findByIdAndUpdate(
        req.worker._id,
        {
          $set: {
            currentLocation: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-expoPushToken -authId -email");

      if (!updatedWorker) {
        return res.status(404).json({
          success: false,
          msg: "Worker not found.",
        });
      }

      return res.status(200).json({
        success: true,
        worker: updatedWorker,
      });
    } catch (err) {
      console.error("Update worker location error:", err);

      return res.status(500).json({
        success: false,
        msg: "Unable to update worker location.",
      });
    }
  }
);

// --------------------------------------------------
// POST /workers/:id/clock-in
// Only the owner can clock in.
// --------------------------------------------------
router.post(
  "/:id/clock-in",
  requireAuth,
  requireOwnWorker,
  async (req, res) => {
    try {
      if (req.worker.currentClock?.clockedIn === true) {
        return res.status(400).json({
          msg: "You are already clocked in.",
        });
      }

      const now = new Date();

      const updatedWorker = await Worker.findByIdAndUpdate(
        req.worker._id,
        {
          $set: {
            "currentClock.clockedIn": true,
            "currentClock.clockInTime": now,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-expoPushToken -authId -email");

      if (!updatedWorker) {
        return res.status(404).json({
          msg: "Worker not found.",
        });
      }

      return res.status(200).json({
        success: true,
        msg: "Clocked in successfully.",
        worker: updatedWorker,
      });
    } catch (err) {
      console.error("Worker clock-in error:", err);

      return res.status(500).json({
        success: false,
        msg: "Unable to clock in.",
      });
    }
  }
);

// --------------------------------------------------
// POST /workers/:id/clock-out
// Only the owner can clock out.
// --------------------------------------------------
router.post(
  "/:id/clock-out",
  requireAuth,
  requireOwnWorker,
  async (req, res) => {
    try {
      if (req.worker.currentClock?.clockedIn !== true) {
        return res.status(400).json({
          msg: "You are not currently clocked in.",
        });
      }

      const clockInTime = req.worker.currentClock.clockInTime;
      const now = new Date();

      if (
        !clockInTime ||
        !Number.isFinite(new Date(clockInTime).getTime()) ||
        new Date(clockInTime).getTime() > now.getTime()
      ) {
        return res.status(400).json({
          msg: "Cannot clock out because the clock-in time is missing or invalid. Please contact support.",
        });
      }

      const elapsedHours =
        (now.getTime() - new Date(clockInTime).getTime()) /
        (1000 * 60 * 60);

      const previousHours =
        Number(req.worker.currentClock.totalHoursToday) || 0;

      const updatedWorker = await Worker.findByIdAndUpdate(
        req.worker._id,
        {
          $set: {
            "currentClock.clockedIn": false,
            "currentClock.clockOutTime": now,
            "currentClock.totalHoursToday": previousHours + elapsedHours,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-expoPushToken -authId -email");

      if (!updatedWorker) {
        return res.status(404).json({
          success: false,
          msg: "Worker not found.",
        });
      }

      return res.status(200).json({
        success: true,
        msg: "Clocked out successfully.",
        worker: updatedWorker,
      });
    } catch (err) {
      console.error("Worker clock-out error:", err);

      return res.status(500).json({
        success: false,
        msg: "Unable to clock out.",
      });
    }
  }
);

module.exports = router;
