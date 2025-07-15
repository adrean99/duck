// In models/LeaveRoster.js
/*const mongoose = require("mongoose");

const leaveRosterSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  year: { type: Number, required: true },
  directorate: { type: String, required: true},
  department: { type: String, required: true },
  periods: [
    {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      leaveType: { type: String, enum: ["Annual Leave", "Short Leave", "Emergency Leave", "Maternity Leave", "Compassionate Leave", "Terminal Leave", "Unpaid Leave", "Sports Leave" ], required: true },
      status: { type: String, enum: ["Suggested", "Approved", "Confirmed", "Rejected", "Counter-Suggested"], default: "" },
      suggestedBy: { type: String, enum: ["Employee", "Director", "HRDirector"], required: true },
    },
  ],
});

module.exports = mongoose.model("LeaveRoster", leaveRosterSchema);
*/
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PeriodSchema = new Schema({
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function (value) {
        return this.startDate <= value;
      },
      message: 'End date must be after start date',
    },
  },
  leaveType: {
    type: String,
    required: [true, 'Leave type is required'],
    enum: {
      values: [
        'Annual Leave',
        'Short Leave',
        'Emergency Leave',
        'Maternity Leave',
        'Terminal Leave',
        'Compassionate Leave',
        'Sports Leave',
        'Unpaid Leave',
      ],
      message: 'Invalid leave type: {VALUE}',
    },
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['Suggested', 'Counter-Suggested', 'Confirmed', 'Rejected', 'Applied', 'Pending'],
      message: 'Invalid status: {VALUE}',
    },
    default: 'Suggested',
  },
  suggestedBy: {
    type: String,
    required: [true, 'Suggested by is required'],
    default: 'Employee',
  },
}, { _id: true }); // Ensure each period has a unique _id

const LeaveRosterSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee ID is required'],
    index: true,
  },
  directorate: {
    type: String,
    required: [true, 'Directorate is required'],
    trim: true,
  },
  department: {
    type: String,
  },
  periods: [PeriodSchema],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Ensure unique roster per employee
LeaveRosterSchema.index({ employeeId: 1 }, { unique: true });

// Validate that periods do not overlap for the same employee
LeaveRosterSchema.pre('save', async function (next) {
  const periods = this.periods;
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const overlapping = periods.some((p, j) => {
      if (i === j) return false;
      return (
        p.startDate <= period.endDate &&
        p.endDate >= period.startDate &&
        p.status !== 'Rejected'
      );
    });
    if (overlapping) {
      return next(new Error('Leave periods cannot overlap for the same employee'));
    }
  }
  next();
});

module.exports = mongoose.model('LeaveRoster', LeaveRosterSchema);