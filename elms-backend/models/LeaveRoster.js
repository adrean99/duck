// In models/LeaveRoster.js
const mongoose = require("mongoose");

const leaveRosterSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  year: { type: Number, required: true },
  department: { type: String, required: true },
  periods: [
    {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      leaveType: { type: String, enum: ["Annual Leave", "Short Leave", "Emergency Leave", "Maternity Leave"], required: true },
      status: { type: String, enum: ["Suggested", "Confirmed", "Rejected"], default: "Suggested" },
      suggestedBy: { type: String, enum: ["Employee", "Supervisor", "HRDirector"], required: true },
    },
  ],
});

module.exports = mongoose.model("LeaveRoster", leaveRosterSchema);