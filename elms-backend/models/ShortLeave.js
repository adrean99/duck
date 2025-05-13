const mongoose = require("mongoose");

const ShortLeaveSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: String, default: ["Short Leave", "Emergency Leave"], required: true },
  status: { 
    type: String, 
    enum: ["Pending", "RecommendedBySectional", "RecommendedByDepartmental", "Approved", "Rejected"], 
    default: "Pending" 
  },
  createdAt: { type: Date, default: Date.now },
  submissionDate: { type: Date, default: Date.now },
  chiefOfficerName: { type: String },
  department: { type: String },
  supervisorName: { type: String },
  employeeName: { type: String },
  personNumber: { type: String },
  daysApplied: { type: Number },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  reason: { type: String, required: true },
  assignedToName: { type: String },
  assignedToDesignation: { type: String },
  recommendation: { type: String },
  approvals: [{
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approverRole: { type: String, default: "Supervisor" },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    comment: { type: String },
    updatedAt: { type: Date, default: Date.now },
  }],
});

module.exports = mongoose.model("ShortLeave", ShortLeaveSchema);