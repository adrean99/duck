const mongoose = require("mongoose");

const leaveRecordSchema = new mongoose.Schema({
  leaveType: { type: String, required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  employeeName: { type: String, required: true },
  personNumber: { type: String, required: true },
  department: { type: String, required: true },
  daysApplied: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], required: true },
  createdAt: { type: Date, default: Date.now },
  originalLeaveId: { type: mongoose.Schema.Types.ObjectId, required: true },
});

module.exports = mongoose.model("LeaveRecord", leaveRecordSchema);