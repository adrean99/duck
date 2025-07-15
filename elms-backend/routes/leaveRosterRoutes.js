const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const LeaveRoster = require('../models/LeaveRoster');
const ShortLeave = require('../models/ShortLeave');
const AnnualLeave = require('../models/AnnualLeave');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { verifyToken, hasRole } = require('../middleware/authMiddleware');
const { logAction } = require('../utils/auditLogger');

const countWorkingDays = (startDate, endDate) => {
  let count = 0;
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return count;
};


router.get('/employee/:id', verifyToken, async (req, res) => {
  try {
    const roster = await LeaveRoster.findOne({ employeeId: req.params.id })
      .populate('employeeId', 'name directorate')
      .lean();
    if (!roster) {
      return res.status(404).json({ message: 'No leave roster found for this employee' });
    }
     if (!['Admin', 'Director', 'DepartmentalHead', 'HrDirector'].includes(req.user.role) && roster.directorate !== req.user.directorate) {
      return res.status(403).json({ error: 'Unauthorized to view this roster' });
    }
    res.json(roster);
  } catch (err) {
    console.error('Error fetching employee roster:', err);
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});


// Fetch metadata (departments)
/*
router.get('/api/metadata', verifyToken, async (req, res) => {
  try {
    const departments = [
      "Department of Education, Training and Devolution",
      "Department of Agriculture, Livestock and Aquaculture Development",
      "Department of County Public Service & Solid Waste Management",
      "Department of Medical Services and Public Health",
      "Department of Transport, Public Works, Infrastructure and Energy",
      "Department of Lands, Physical Planning, Housing and Urban Development",
      "Department of Finance, Economic Planning &ICT",
      "Department of Water, Irrigation, Environment and Climate Change",
      "Department of Gender, Youth and Social Services",
      "Department of Trade, Tourism, Culture and Cooperative Development",
    ];
    res.json({ departments });
  } catch (err) {
    console.error('Error fetching metadata:', err);
    res.status(500).json({ error: 'Failed to fetch metadata', details: err.message });
  }
});
*/
// Fetch user profile


// Fetch employees by directorate and/or department
router.get('/api/users', verifyToken, async (req, res) => {
  try {
    const { directorate, department, excludeRole } = req.query;
    const query = {};
    if (directorate) query.directorate = directorate;
    if (department) query.department = department;
    if (excludeRole) query.role = { $ne: excludeRole };
    const users = await User.find(query).select('name directorate department role _id');
    res.json(users);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ error: 'Failed to fetch employees', details: err.message });
  }
});

// Fetch approved leaves
router.get('/api/leaves/approved', verifyToken, async (req, res) => {
  try {
    const { month, directorate, department } = req.query;
    const query = { status: 'Approved' };
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const start = new Date(year, monthNum - 1, 1);
      const end = new Date(year, monthNum, 0);
      query.startDate = { $gte: start, $lte: end };
    }
    if (directorate) query.directorate = directorate;
    if (department) query.department = department;
    const leaves = await AnnualLeave.find(query).populate('employeeId', 'name').lean();
    const shortLeaves = await ShortLeave.find(query).populate('employeeId', 'name').lean();
    const allLeaves = [...leaves, ...shortLeaves].map(leave => ({
      ...leave,
      employeeName: leave.employeeId?.name || 'Unknown',
    }));
    res.json(allLeaves);
  } catch (err) {
    console.error('Error fetching approved leaves:', err);
    res.status(500).json({ error: 'Failed to fetch approved leaves', details: err.message });
  }
});

// Fetch leave roster for an employee
router.get('/employee/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid employeeId' });
    }
    if (req.user.id !== id && !['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to view this roster' });
    }
    const roster = await LeaveRoster.findOne({ employeeId: id }).populate('employeeId', 'name department directorate');
    if (!roster) {
      return res.status(200).json({ message: 'No leave roster found for this employee' });
    }
    res.json(roster);
  } catch (err) {
    console.error('Error fetching employee leave roster:', err);
    res.status(500).json({ error: 'Failed to fetch roster', details: err.message });
  }
});

// Fetch leave rosters for a directorate
router.get('/directorate/:directorate', verifyToken, async (req, res) => {
  try {
    const { directorate } = req.params;
    const { department } = req.query;

    if (!directorate || directorate === 'Unknown') {
      return res.status(400).json({ error: 'Valid directorate is required' });
    }
    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role) && directorate !== req.user.directorate) {
      return res.status(403).json({ error: 'Unauthorized to view this directorate' });
    }

    const query = { directorate };
    if (department && department !== 'undefined') {
      query.department = department;
    }

    const rosters = await LeaveRoster.find(query)
    .populate('employeeId', 'name')
    .lean();

    if (!rosters.length) {
      return res.status(404).json({ error: `No rosters found for directorate: ${directorate}` });
    }

    res.json(rosters);
  } catch (err) {
    console.error('Error fetching leave rosters:', err);
    res.status(500).json({ error: 'Failed to fetch leave rosters' });
  }
});

router.get('/all', verifyToken, async (req, res) => {
  try {
    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized: Admin, Director, or DepartmentalHead role required' });
    }
    const { department } = req.query;
    const query = department && department !== 'undefined' ? { department } : {};
    const rosters = await LeaveRoster.find(query)
      .populate('employeeId', 'name directorate')
      .lean();
    if (!rosters.length) {
      return res.status(404).json({ error: 'No rosters found' });
    }
    res.json(rosters);
  } catch (err) {
    console.error('Error fetching all rosters:', err);
    res.status(500).json({ error: 'Failed to fetch all rosters' });
  }
});

// Fetch suggested leave periods
router.get('/suggested', verifyToken, hasRole(['Director', 'DepartmentalHead', 'HRDirector', 'Admin']), async (req, res) => {
   try {
    const { directorate, department } = req.query;
    const query = { 'periods.status': { $in: ['Suggested', 'Counter-Suggested', 'Pending'] } };
    if (directorate && directorate !== 'Unknown') {
      query.directorate = directorate;
    }
    if (department && department !== 'undefined') {
      query.department = department;
    }
    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role)) {
      query.directorate = req.user.directorate;
    }

    const rosters = await LeaveRoster.find(query)
      .populate('employeeId', 'name department directorate')
      .lean();

    const suggestedPeriods = rosters.flatMap(roster =>
      roster.periods
         .filter(period => ['Suggested', 'Counter-Suggested', 'Pending'].includes(period.status))
        .map(period => ({
          _id: period._id,
          employeeId: {
            _id: roster.employeeId._id,
            name: roster.employeeId.name,
            department: roster.employeeId.department,
            directorate: roster.employeeId.directorate,
          },
          startDate: period.startDate,
          endDate: period.endDate,
          leaveType: period.leaveType,
          status: period.status,
        }))
    );
    //logAction('Viewed suggested leave periods', req.user, { directorate, department });
    res.json(suggestedPeriods);
  } catch (err) {
    console.error('Error fetching suggested leave periods:', err);
    res.status(500).json({ error: 'Failed to fetch suggested leave periods', details: err.message });
  }
}); 

router.post('/suggest/:id', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, leaveType } = req.body;
    const employee = await User.findById(req.params.id).select('directorate department');
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (!['Admin', 'Director', 'DepartmentalHead'].includes(req.user.role) && employee.directorate !== req.user.directorate) {
      return res.status(403).json({ error: 'Unauthorized to suggest leave for this employee' });
    }
    let roster = await LeaveRoster.findOne({ employeeId: req.params.id });
    if (!roster) {
      roster = new LeaveRoster({
        employeeId: req.params.id,
        year: new Date(startDate).getFullYear(),
        directorate: employee.directorate,
        department: employee.department || req.user.department, // Fallback to req.user.department
        periods: [{ startDate, endDate, leaveType, status: 'Suggested', suggestedBy: req.user.role === 'Employee' ? 'Employee' : req.user.role }],
      });
    } else {
      if (!['Admin', 'Director', 'DepartmentalHead'].includes(req.user.role) && roster.directorate !== req.user.directorate) {
        return res.status(403).json({ error: 'Unauthorized to modify this roster' });
      }
      roster.periods.push({ startDate, endDate, leaveType, status: 'Suggested', suggestedBy: req.user.role === 'Employee' ? 'Employee' : req.user.role });
    }
    await roster.save();
    res.json({ roster });
  } catch (err) {
    console.error('Error suggesting period:', err);
    res.status(500).json({ error: 'Failed to suggest period' });
  }
});


// Suggest a leave period
router.post('/suggest/:employeeId', verifyToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, leaveType } = req.body;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ error: 'Invalid employeeId' });
    }
    if (!startDate || !endDate || !leaveType) {
      return res.status(400).json({ error: 'startDate, endDate, and leaveType are required' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }
    if (start > end) {
      return res.status(400).json({ error: 'startDate cannot be later than endDate' });
    }
    const validLeaveTypes = [
      'Annual Leave', 'Short Leave', 'Emergency Leave', 'Maternity Leave',
      'Terminal Leave', 'Compassionate Leave', 'Sports Leave', 'Unpaid Leave'
    ];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({ error: `leaveType must be one of: ${validLeaveTypes.join(', ')}` });
    }
    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    const profile = await Profile.findOne({ userId: employeeId });
    if (!profile) return res.status(400).json({ error: 'Employee profile not found' });
    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role) && employee.directorate !== req.user.directorate) {
      return res.status(403).json({ error: 'Unauthorized to suggest leave for this employee' });
    }
    let roster = await LeaveRoster.findOne({ employeeId });
    if (!roster) {
      roster = new LeaveRoster({
        employeeId,
        year: new Date(startDate).getFullYear(),
        directorate: profile.directorate,
        department: profile.department || employee.department,
        periods: [],
      });
    }
    const departmentLeaves = await LeaveRoster.find({
      department: roster.department,
      employeeId: { $ne: employeeId },
      periods: {
        $elemMatch: {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) },
          status: 'Confirmed',
        },
      },
    });
    if (departmentLeaves.length > 0) {
      return res.status(400).json({ error: 'Leave period overlaps with another employee in the same department' });
    }
    const newPeriod = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      leaveType,
      status: 'Suggested',
      suggestedBy: req.user.role === 'Employee' ? 'Employee' : req.user.role,
    };
    roster.periods.push(newPeriod);
    await roster.save();
    const io = req.app.get('io');
     if (io) {
      const newLeave = {
        _id: newPeriod._id,
        employeeId: {
          _id: roster.employeeId,
          name: employee.name,
          department: roster.department,
          directorate: roster.directorate,
        },
        startDate: newPeriod.startDate,
        endDate: newPeriod.endDate,
        leaveType: newPeriod.leaveType,
        status: newPeriod.status,
        directorate: roster.directorate,
      };
      io.to('admin-room').emit('leaveSuggested', newLeave);
      io.to(`directorate:${roster.directorate}`).emit('leaveSuggested', newLeave);
    }
    //logAction('Suggested leave period', req.user, { employeeId, startDate, endDate, leaveType });
    res.status(201).json({ message: 'Leave period suggested', roster });
  } catch (err) {
    console.error('Error suggesting leave period:', err);
    res.status(500).json({ error: 'Failed to suggest period', details: err.message });
  }
});

// Counter-suggest a leave period
router.put('/suggest/:periodId', verifyToken, hasRole(['Director', 'DepartmentalHead', 'HRDirector', 'Admin']), async (req, res) => {
  try {
    const { periodId } = req.params;
    const { startDate, endDate, leaveType, status = 'Counter-Suggested' } = req.body;
    if (!startDate || !endDate || !leaveType) {
      return res.status(400).json({ error: 'startDate, endDate, and leaveType are required' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }
    if (start > end) {
      return res.status(400).json({ error: 'startDate cannot be later than endDate' });
    }
    const validLeaveTypes = [
      'Annual Leave', 'Short Leave', 'Emergency Leave', 'Maternity Leave',
      'Terminal Leave', 'Compassionate Leave', 'Sports Leave', 'Unpaid Leave'
    ];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({ error: `leaveType must be one of: ${validLeaveTypes.join(', ')}` });
    }
    const roster = await LeaveRoster.findOneAndUpdate(
      { 'periods._id': periodId },
      {
        $set: {
          'periods.$.startDate': start,
          'periods.$.endDate': end,
          'periods.$.leaveType': leaveType,
          'periods.$.status': status,
          'periods.$.suggestedBy': req.user.role,
        },
      },
      { new: true }
    ).populate('employeeId', 'name department directorate');
    if (!roster) {
      return res.status(404).json({ error: 'Leave period not found' });
    }
    const updatedPeriod = roster.periods.id(periodId);
    const io = req.app.get('io');
    if (io) {
      const updatedLeave = {
        _id: updatedPeriod._id,
        employeeId: {
          _id: roster.employeeId._id,
          name: roster.employeeId.name,
          department: roster.employeeId.department,
          directorate: roster.employeeId.directorate,
        },
        startDate: updatedPeriod.startDate,
        endDate: updatedPeriod.endDate,
        leaveType: updatedPeriod.leaveType,
        status: updatedPeriod.status,
        directorate: roster.directorate,
      };
      io.to('admin-room').emit('leaveSuggested', updatedLeave);
      io.to(`directorate:${roster.directorate}`).emit('leaveSuggested', updatedLeave);
    }
    //logAction('Counter-suggested leave period', req.user, { periodId, startDate, endDate, leaveType });
    res.json(updatedPeriod);
  } catch (err) {
    console.error('Error counter-suggesting leave period:', err);
    res.status(500).json({ error: 'Failed to counter-suggest', details: err.message });
  }
});

// Update leave period status
router.patch('/update-period/:rosterId/:periodId', verifyToken, hasRole(['Director', 'DepartmentalHead', 'HRDirector', 'Admin']), async (req, res) => {
  try {
    const { rosterId, periodId } = req.params;
    const { status } = req.body;
    if (!['Confirmed', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'Confirmed' or 'Rejected'" });
    }
    const roster = await LeaveRoster.findByIdAndUpdate(
      rosterId,
      { $set: { 'periods.$[period].status': status } },
      { arrayFilters: [{ 'period._id': periodId }], new: true }
    ).populate('employeeId', 'name department directorate');
    if (!roster) return res.status(404).json({ error: 'Roster not found' });
    const period = roster.periods.id(periodId);
    if (!period) return res.status(404).json({ error: 'Period not found' });
    const io = req.app.get('io');
    if (io) {
      const updatedLeave = {
        _id: period._id,
        employeeId: {
          _id: roster.employeeId._id,
          name: roster.employeeId.name,
          department: roster.employeeId.department,
          directorate: roster.employeeId.directorate,
        },
        startDate: period.startDate,
        endDate: period.endDate,
        leaveType: period.leaveType,
        status: period.status,
        directorate: roster.directorate,
      };
      io.to('admin-room').emit('leaveSuggested', updatedLeave);
      io.to(`directorate:${roster.directorate}`).emit('leaveSuggested', updatedLeave);
      if (status === 'Confirmed') {
        io.to(`directorate:${roster.directorate}`).emit('leaveStatusUpdate', { periodId, status });
      }
    }
    //logAction('Updated leave period status', req.user, { rosterId, periodId, status });
    res.json(period);
  } catch (err) {
    console.error('Error updating leave period:', err);
    res.status(500).json({ error: 'Failed to update period', details: err.message });
  }
});

// Apply leave from roster
router.post('/apply-from-roster/:rosterId/:periodId', verifyToken, async (req, res) => {
  try {
    const { rosterId, periodId } = req.params;
    const roster = await LeaveRoster.findById(rosterId).populate('employeeId', 'name department directorate');
    if (!roster) return res.status(404).json({ error: 'Roster not found' });
    if (roster.employeeId._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to apply for this leave' });
    }
    const period = roster.periods.id(periodId);
    if (!period || period.status !== 'Confirmed') {
      return res.status(400).json({ error: 'Leave period not found or not confirmed' });
    }
    const { leaveType, startDate, endDate } = period;
    const validLeaveTypes = [
      'Annual Leave', 'Short Leave', 'Emergency Leave', 'Maternity Leave',
      'Terminal Leave', 'Compassionate Leave', 'Sports Leave', 'Unpaid Leave'
    ];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({ error: `leaveType must be one of: ${validLeaveTypes.join(', ')}` });
    }
    let leave;
    if (['Short Leave', 'Emergency Leave', 'Compassionate Leave', 'Sports Leave'].includes(leaveType)) {
      leave = new ShortLeave({
        employeeId: roster.employeeId._id,
        leaveType,
        employeeName: roster.employeeId.name,
        personNumber: 'N/A',
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: `${leaveType} applied from roster`,
        status: 'Pending',
        directorate: roster.directorate,
      });
    } else {
      leave = new AnnualLeave({
        employeeId: roster.employeeId._id,
        leaveType,
        employeeName: roster.employeeId.name,
        personNumber: 'N/A',
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: `${leaveType} applied from roster`,
        status: 'Pending',
        directorate: roster.directorate,
        approvals: [
          { approverRole: 'Director', status: 'Pending' },
          { approverRole: 'DepartmentalHead', status: 'Pending' },
          { approverRole: 'HRDirector', status: 'Pending' },
        ],
      });
    }
    await leave.save();
    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('newLeaveRequest', {
        leaveType: leave.leaveType,
        employeeName: leave.employeeName,
        id: leave._id,
        directorate: roster.directorate,
      });
      io.to(`directorate:${roster.directorate}`).emit('newLeaveRequest', {
        leaveType: leave.leaveType,
        employeeName: leave.employeeName,
        id: leave._id,
        directorate: roster.directorate,
      });
      io.to(`directorate:${roster.directorate}`).emit('leaveStatusUpdate', {
        employeeId: roster.employeeId._id,
        periodId,
        status: 'Applied',
      });
    }
    //logAction('Applied leave from roster', req.user, { rosterId, periodId, leaveType });
    res.status(201).json({ message: 'Leave applied successfully', leave });
  } catch (err) {
    console.error('Error applying leave from roster:', err);
    res.status(500).json({ error: 'Failed to apply leave', details: err.message });
  }
});

module.exports = router;