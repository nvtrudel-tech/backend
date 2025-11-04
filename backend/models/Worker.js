const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    // --- Link to Auth User (from your new schema) ---
    authId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true, // Keeping this commented out to match your worker-first flow
      // unique: true,
    },

    // --- Personal Details ---
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String }, // Kept from new schema
    age: { type: Number },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say']
    },
    
    // --- Profile Image (Merged from both schemas) ---
    profileImageBase64: { // From original canvas file
      type: String,
      default: null,
    },
    profileImageUrl: { // Fallback (from original canvas)
      type: String 
    },

    // --- Work Details ---
    skills: [String],
    maxDistance: { type: Number, default: 25 },
    currentLocation: { // From new schema (better for geo-queries)
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    },

    // --- Availability (from new schema) ---
    availability: {
      monday: { start: String, end: String, available: Boolean },
      tuesday: { start: String, end: String, available: Boolean },
      wednesday: { start: String, end: String, available: Boolean },
      thursday: { start: String, end: String, available: Boolean },
      friday: { start: String, end: String, available: Boolean },
      saturday: { start: String, end: String, available: Boolean },
      sunday: { start: String, end: String, available: Boolean },
    },

    // --- Clock (from new schema, matches your routes file) ---
    currentClock: {
      clockedIn: { type: Boolean, default: false },
      clockInTime: { type: Date },
      clockOutTime: { type: Date },
      totalHoursToday: { type: Number, default: 0 },
    },
    // Note: clockHistory from your original file was removed as it's not in the new schema.
    // We can add it back if you need it.

    // --- Push Token (Merged) ---
    expoPushToken: { 
      type: String,
      default: null, // (safer default)
    },
  },
  { timestamps: true }
);

// --- Index from new schema ---
workerSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Worker", workerSchema);

