const mongoose = require("mongoose");

const ShortLeaveSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: String, default: "Short Leave", required: true },
  status: { 
    type: String, 
    enum: ["Pending", "RecommendedByDirector", "RecommendedByDepartmental", "Approved", "Rejected"], 
    default: "Pending" 
  },
  currentApprover: { type: String, enum: ["Director", "DepartmentalHead", "HRDirector"], default: "Director" },
  submissionDate: { type: Date, default: Date.now },
  chiefOfficerName: { type: String },
  department: { type: String },
  directorName: { type: String },
  employeeName: { type: String },
  personNumber: { type: String },
  daysApplied: { type: Number },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  reason: { type: String, required: true },
  assignedToName: { type: String },
  assignedToDesignation: { type: String },
  recommendation: { type: String }, // Retained but optional
  approvals: [
    {
      approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approverRole: { type: String, enum: ["Director", "DepartmentalHead", "HRDirector"], required: true },
      status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
      comment: { type: String },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  directorRecommendation: { type: String, enum: ["Pending", "Recommended", "Rejected"], default: "Pending" },
  departmentalHeadRecommendation: { type: String, enum: ["Pending", "Recommended", "Rejected"], default: "Pending" },
  approverRecommendation: { type: String, enum: ["Pending", "Recommended", "Rejected"], default: "Pending" },
  directorDate: { type: Date },
  departmentalHeadDate: { type: Date },
  approverDate: { type: Date },
}, { timestamps: true });

ShortLeaveSchema.pre('save', function(next) {
  if (this.isNew) {
    this.approvals = [
      { approverRole: "Director", status: "Pending" },
      { approverRole: "DepartmentalHead", status: "Pending" },
      { approverRole: "HRDirector", status: "Pending" },
    ];
    this.directorRecommendation = "Pending";
    this.departmentalHeadRecommendation = "Pending";
    this.approverRecommendation = "Pending";
  }
  next();
});

module.exports = mongoose.model("ShortLeave", ShortLeaveSchema);