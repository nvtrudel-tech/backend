const mongoose = require("mongoose");

// --- NEW: Price Breakdown Sub-schema ---
// This defines the structure for an individual line item (e.g., "Labour", "Materials")
const PriceItemSchema = new mongoose.Schema({
  item: { type: String, required: true },
  price: { type: Number, required: true }
}, { _id: false }); // _id: false prevents MongoDB from creating an _id for each line item
// ---

const appointmentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    service: { type: String, required: true },
    date: { type: Date, required: true },
    address: { type: String, required: true },
    description: { type: String, required: true },
    
    // --- MODIFIED: Price fields ---
    priceBreakdown: [PriceItemSchema], 
    totalPrice: { type: Number, default: 0 },
    workerPrice: { type: Number, default: 0 }, 
    // ---

    status: {
      type: String,
      enum: ["pending", "price_pending", "confirmed", "en_route", "completed", "cancelled"],
      default: "pending",
    },

    // --- NEW: Cancellation Reason ---
    cancellationReason: {
      type: String,
      default: null // Only populated if the status is 'cancelled'
    },
    // ---
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);