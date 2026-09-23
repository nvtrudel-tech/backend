const mongoose = require("mongoose");

const timeEntrySchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    type: {
      type: String,
      enum: ["work", "break"],
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    flaggedAnomaly: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Fast lookups for "is there an open entry for this worker"
timeEntrySchema.index({ workerId: 1, endTime: 1 });
timeEntrySchema.index({ appointmentId: 1 });

module.exports = mongoose.model("TimeEntry", timeEntrySchema);
