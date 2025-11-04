const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Adjust path as needed
const router = express.Router();

// ✅ SIGNUP
router.post("/signup", async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: "User already exists" });

    // Note: The User model pre-save hook will hash the password
    const user = new User({ name, email, phone, password, role });
    await user.save();
    
    // Don't send password back
    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profileImageBase64: user.profileImageBase64,
    };

    res.status(201).json({ success: true, user: safeUser });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ✅ LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid password" });

    // Send back all relevant user data (except password)
    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profileImageBase64: user.profileImageBase64, // Include profile image
    };

    res.status(200).json({ success: true, user: safeUser });
  } catch (err)
 {
    console.error("Login error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// --- GET USER DETAILS FOR PROFILE SCREEN ---
router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password"); // Find user, exclude password
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// --- UPDATE USER PROFILE ---
router.put("/user/:id", async (req, res) => {
  try {
    const { name, email, phone, profileImageBase64 } = req.body;

    const updatedData = {
      name,
      email,
      phone,
      profileImageBase64,
    };

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updatedData },
      { new: true }
    ).select("-password"); // Return the updated user, exclude password

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user); // Send back the updated user object
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


// --- SAVE CUSTOMER PUSH TOKEN ---
// (This is already called from your index.js)
router.post("/save-push-token", async (req, res) => {
  const { userId, token } = req.body;

  if (!userId) {
    return res.status(400).json({ msg: "User ID is required" });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { expoPushToken: token || null },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    console.log(`Updated push token for CUSTOMER ${userId}`); // Server log
    res.status(200).json({ success: true, msg: "Token saved" });
  } catch (err) {
    console.error("Save customer token error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
});
// ---

module.exports = router;

