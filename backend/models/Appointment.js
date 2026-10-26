
const mongoose = require("mongoose");

// Price Breakdown Sub-schema
const PriceItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
    },
    service: { type: String, required: true },
    date: { type: Date, required: true },
    address: { type: String, required: true },
    description: { type: String, required: true },

    // Price fields
    priceBreakdown: [PriceItemSchema],
    totalPrice: { type: Number, default: 0 },
    workerPrice: { type: Number, default: 0 },

    status: {
      type: String,
      enum: [
        "pending",
        "price_pending",
        "confirmed",
        "en_route",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },

    // Cancellation reason
    cancellationReason: {
      type: String,
      default: null,
    },

    // Employer archive fields
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
