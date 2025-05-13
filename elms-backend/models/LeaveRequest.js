const mongoose = require("mongoose");

const LeaveRequestSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  employeeName: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("LeaveRequest", LeaveRequestSchema);
