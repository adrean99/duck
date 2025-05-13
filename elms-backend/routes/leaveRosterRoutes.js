// In routes/leaveRosterRoutes.js (create this file)
const express = require("express");
const router = express.Router();
const LeaveRoster = require("../models/LeaveRoster");
const ShortLeave = require("../models/ShortLeave");
const AnnualLeave = require("../models/AnnualLeave");
const Profile = require("../models/Profile");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");
const User = require("../models/User");
const countWorkingDays = (startDate, endDate) => {
  let count = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sunday (0) and Saturday (6)
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
};

// Get leave roster for an employee
router.get("/:employeeId", verifyToken, hasRole(["Employee", "Supervisor", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const year = new Date().getFullYear();
    console.log('Fetching roster for employeeId:', employeeId);


    let roster = await LeaveRoster.findOne({ employeeId, year }).populate("employeeId", "name department");
    if (!roster) {
      const employee = await User.findById(employeeId);
      console.log('User found:', employee);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      // Check Profile for department if not in User
      let department = employee.department;
      console.log('User department:', department);
      if (!department) {
        const profile = await Profile.findOne({ userId: employeeId });
        console.log('Profile found:', profile);
        if (!profile || !profile.department) {
          console.log('Profile or department missing for employeeId:', employeeId);
          return res.status(400).json({ error: 'Employee department is required but not set' });
        }
        department = profile.department;
        console.log('Using department from Profile:', department);
      }

      roster = new LeaveRoster({ 
        employeeId, 
        year, 
        department, 
        periods: [] 
      });
      await roster.save();
      console.log('Created new roster:', roster);
    }
    res.status(200).json(roster);
  } catch (error) {
    console.error("Error fetching leave roster:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Suggest/Edit leave period (Employee)
router.post("/suggest/:employeeId", verifyToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, leaveType } = req.body;
    const year = new Date().getFullYear();
    
    if (!startDate || !endDate || !leaveType) {
      return res.status(400).json({ error: "startDate, endDate, and leaveType are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid startDate or endDate" });
    }
    if (start > end) {
      return res.status(400).json({ error: "startDate cannot be later than endDate" });
    }
    const validLeaveTypes = ["Short Leave", "Annual Leave", "Emergency Leave", "Maternity Leave"];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({ error: `leaveType must be one of: ${validLeaveTypes.join(", ")}` });
    }
    
    if (req.user.id !== employeeId.toString() && !["Supervisor", "HRDirector", "Admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized to suggest leave for this employee" });
    }

    let roster = await LeaveRoster.findOne({ employeeId, year }).populate("employeeId", "department");
    if (!roster) {
      const employee = await User.findById(employeeId);
      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      let department = employee.department;
      if (!department) {
        const profile = await Profile.findOne({ userId: employeeId });
        if (!profile || !profile.department) {
          return res.status(400).json({ error: 'Employee department is required but not set' });
        }
        department = profile.department;
      }

      roster = new LeaveRoster({ 
        employeeId, 
        year, 
        department, 
        periods: [] 
      });
    }
    // Check for overlapping leaves in the same department
    const departmentLeaves = await LeaveRoster.find({
      department: roster.department,
      employeeId: { $ne: employeeId },
      "periods.startDate": { $lte: new Date(endDate) },
      "periods.endDate": { $gte: new Date(startDate) },
      "periods.status": "Confirmed",
    });

    if (departmentLeaves.length > 0) {
      return res.status(400).json({ error: "Leave period overlaps with another employee in the same department" });
    }

    roster.periods.push({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      leaveType,
      status: "Suggested",
      suggestedBy: req.user.role === "Employee" ? "Employee" : req.user.role,
    });

    await roster.save();
    res.status(200).json({ message: "Leave period suggested", roster });
  } catch (error) {
    console.error("Error suggesting leave period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Confirm/Reject leave period (Supervisor/HRDirector)
router.patch("/update-period/:rosterId/:periodId", verifyToken, hasRole(["Supervisor", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { rosterId, periodId } = req.params;
    const { status } = req.body; // "Confirmed" or "Rejected"

    const roster = await LeaveRoster.findById(rosterId);
    if (!roster) return res.status(404).json({ error: "Roster not found" });

    const period = roster.periods.id(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    period.status = status;
    await roster.save();

    const io = req.app.get("io");
if (io) {
  io.emit("rosterUpdate", { employeeId: roster.employeeId, periodId, status });
} else {
  console.warn("Socket.io not initialized; cannot emit rosterUpdate event");
}

    res.status(200).json({ message: "Leave period updated", roster });
  } catch (error) {
    console.error("Error updating leave period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Apply for leave from roster
router.post("/apply-from-roster/:rosterId/:periodId", verifyToken, async (req, res) => {
  try {
    const { rosterId, periodId } = req.params;
    const roster = await LeaveRoster.findById(rosterId).populate("employeeId", "name department");
    if (!roster) return res.status(404).json({ error: "Roster not found" });

    if (roster.employeeId._id.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to apply for this leave" });
    }

    const period = roster.periods.id(periodId);
    if (!period || period.status !== "Confirmed") {
      return res.status(400).json({ error: "Leave period not found or not confirmed" });
    }

    const { leaveType, startDate, endDate } = period;
    let leave;
    if (leaveType === "Short Leave") {
      leave = new ShortLeave({
        employeeId: roster.employeeId._id,
        leaveType: "Short Leave",
        employeeName: roster.employeeId.name,
        personNumber: "N/A",
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: "Applied from roster",
        status: "Pending",
      });
    } else if (leaveType === "Annual Leave") {
      leave = new AnnualLeave({
        employeeId: roster.employeeId._id,
        leaveType: "Annual Leave",
        employeeName: roster.employeeId.name,
        personNumber: "N/A",
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: "Applied from roster",
        status: "Pending",
        approvals: [
          { approverRole: "Sectional Head", status: "Pending" },
          { approverRole: "Departmental Head", status: "Pending" },
          { approverRole: "HR Director", status: "Pending" },
        ],
      });
    } else if (leaveType === "Emergency Leave") {
      leave = new ShortLeave({
        employeeId: roster.employeeId._id,
        leaveType: "Emergency Leave",
        employeeName: roster.employeeId.name,
        personNumber: "N/A",
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: "Emergency leave applied from roster",
        status: "Pending",
      });
    } else if (leaveType === "Maternity Leave") {
      leave = new AnnualLeave({
        employeeId: roster.employeeId._id,
        leaveType: "Maternity Leave",
        employeeName: roster.employeeId.name,
        personNumber: "N/A",
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: "Maternity leave applied from roster",
        status: "Pending",
        approvals: [
          { approverRole: "Sectional Head", status: "Pending" },
          { approverRole: "Departmental Head", status: "Pending" },
          { approverRole: "HR Director", status: "Pending" },
        ],
      });
    }

    await leave.save();

    const io = req.app.get("io");
if (io) {
  io.emit("newLeaveRequest", {
    leaveType: leave.leaveType,
    employeeName: leave.employeeName,
    id: leave._id,
  });
} else {
  console.warn("Socket.io not initialized; cannot emit newLeaveRequest event");
}

    res.status(201).json({ message: "Leave applied successfully", leave });
  } catch (error) {
    console.error("Error applying leave from roster:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;