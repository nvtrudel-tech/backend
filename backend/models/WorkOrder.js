// backend/models/WorkOrder.js
const mongoose = require("mongoose");

const workOrderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },
  service: String,
  status: {
    type: String,
    enum: [
      'estimate-requested', // Customer just sent the request
      'estimate-provided',  // Worker sent an estimate
      'approved',           // Customer approved the estimate
      'completed',          // Worker finished the job
      'invoiced',           // (Future step: for billing)
      'paid'                // (Future step: for billing)
    ],
    default: 'estimate-requested'
  },
  
  // Customer-provided info
  address: String,
  customerDescription: String,
  appointmentDate: Date, // The date and time from Step 1

  // Worker-provided info (for the estimate/invoice)
  workerNotes: String,
  lineItems: [{
    description: String,
    cost: Number
  }],
  totalCost: Number
  
}, { timestamps: true });

module.exports = mongoose.model("WorkOrder", workOrderSchema);