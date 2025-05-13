const mongoose = require("mongoose");

const leaveBalanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  year: { type: Number, default: new Date().getFullYear() }, // Track balances by year
  leaveBalanceBF: { type: Number, default: 0 }, 
  currentYearLeave: { type: Number, default: 30 }, 
  leaveTakenThisYear: { type: Number, default: 0 }, 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

leaveBalanceSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);