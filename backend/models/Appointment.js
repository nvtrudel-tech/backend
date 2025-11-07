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
    // We now store an array of price items
    priceBreakdown: [PriceItemSchema], 
    // We also store the calculated total for easy access
    totalPrice: { type: Number, default: 0 },
    // We keep workerPrice as well for backwards compatibility, but it will be set to the total
    workerPrice: { type: Number, default: 0 }, 
    // ---

    status: {
      type: String,
      enum: ["pending", "price_pending", "confirmed", "en_route", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);