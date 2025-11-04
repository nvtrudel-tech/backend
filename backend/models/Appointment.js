const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    service: { type: String, required: true },
    date: { type: Date, required: true },
    address: { type: String, required: true },
    description: { type: String, required: true },
    // --- CORRECTED FIELD: workerPrice (to resolve "no field as price" bug) ---
    workerPrice: { type: Number, default: null }, 
    status: {
      type: String,
      // --- MODIFIED: Added 'en_route' to the enum ---
      enum: ["pending", "price_pending", "confirmed", "en_route", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
