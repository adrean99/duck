const mongoose = require("mongoose");

const AnnualLeaveSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: String, default: "Annual Leave", required: true },
  status: { 
    type: String, 
    enum: ["Pending", "RecommendedByDirector", "RecommendedByDepartmental", "Approved", "Rejected"], 
    default: "Pending"
  },
  currentApprover: { type: String, enum: ["Director", "DepartmentalHead", "HRDirector"], default: "Director" },
  submissionDate: { type: Date, default: Date.now },
  employeeName: { type: String, required: true },
  personNumber: { type: String, required: true },
  department: { type: String, required: true },
  directorate: { type: String },
  daysApplied: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  addressWhileAway: { type: String },
  emailAddress: { type: String },
  phoneNumber: { type: String },
  reason: { type: String, required: true },
  leaveBalanceBF: { type: Number, default: 0 },
  currentYearLeave: { type: Number, default: 0 },
  totalLeaveDays: { type: Number },
  leaveTakenThisYear: { type: Number, default: 0 },
  leaveBalanceDue: { type: Number },
  leaveApplied: { type: Number, required: true },
  leaveBalanceCF: { type: Number },
  computedBy: { type: String },
  computedDate: { type: Date },
  directorName: { type: String },
  departmentalHeadName: { type: String },
  HRDirectorName: { type: String },
  approvals: [
    {
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
  departmentalHeadDaysGranted: { type: Number },
  departmentalHeadStartDate: { type: Date },
  departmentalHeadLastDate: { type: Date },
  departmentalHeadResumeDate: { type: Date },
  approverDate: { type: Date },
}, { timestamps: true });

AnnualLeaveSchema.pre('save', function(next) {
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

module.exports = mongoose.model("AnnualLeave", AnnualLeaveSchema);