const express = require("express");
const router = express.Router();
const LeaveRoster = require("../models/LeaveRoster");
const ShortLeave = require("../models/ShortLeave");
const AnnualLeave = require("../models/AnnualLeave");
const Profile = require("../models/Profile");
const User = require("../models/User");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");

const countWorkingDays = (startDate, endDate) => {
  let count = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
};

// Get leave roster for an employee
router.get("/:employeeId", verifyToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const year = new Date().getFullYear();

    if (req.user.id !== employeeId && !["Admin", "Supervisor", "SectionalHead", "DepartmentalHead", "HRDirector"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized to view this roster" });
    }

    let roster = await LeaveRoster.findOne({ employeeId, year }).populate("employeeId", "name department");
    if (!roster) {
      const employee = await User.findById(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      let department = employee.department;
      if (!department) {
        const profile = await Profile.findOne({ userId: employeeId });
        if (!profile || !profile.department) {
          return res.status(400).json({ error: "Employee department is required but not set" });
        }
        department = profile.department;
      }

      roster = new LeaveRoster({ 
        employeeId, 
        year, 
        department, 
        periods: [] 
      });
      await roster.save();
    }
    res.status(200).json(roster);
  } catch (error) {
    console.error("Error fetching leave roster:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get leave rosters for all employees in the same sector
router.get("/sector/:sector", verifyToken, async (req, res) => {
  try {
    const { sector } = req.params;
    const year = new Date().getFullYear();

    const profiles = await Profile.find({ sector });
    const employeeIds = profiles.map(profile => profile.userId);

    const rosters = await LeaveRoster.find({ 
      employeeId: { $in: employeeIds }, 
      year 
    }).populate("employeeId", "name department");

    res.status(200).json(rosters);
  } catch (error) {
    console.error("Error fetching leave rosters for sector:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Suggest/Edit leave period
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
    const validLeaveTypes = [
      "Short Leave", "Annual Leave", "Emergency Leave", "Maternity Leave",
      "Terminal", "Compassionate", "Sports", "Unpaid"
    ];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({ error: `leaveType must be one of: ${validLeaveTypes.join(", ")}` });
    }
    
    if (req.user.id !== employeeId && !["Supervisor", "HRDirector", "Admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized to suggest leave for this employee" });
    }

    let roster = await LeaveRoster.findOne({ employeeId, year }).populate("employeeId", "department");
    if (!roster) {
      const employee = await User.findById(employeeId);
      if (!employee) return res.status(404).json({ error: "Employee not found" });

      let department = employee.department;
      if (!department) {
        const profile = await Profile.findOne({ userId: employeeId });
        if (!profile || !profile.department) {
          return res.status(400).json({ error: "Employee department is required but not set" });
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

    const departmentLeaves = await LeaveRoster.find({
      department: roster.department,
      employeeId: { $ne: employeeId },
      periods: {
        $elemMatch: {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) },
          status: "Confirmed",
        },
      },
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

    const io = req.app.get("io");
    if (io) {
      const profile = await Profile.findOne({ userId: employeeId });
      if (profile && profile.sector) {
        io.to(`sector:${profile.sector}`).emit("rosterUpdate", { employeeId, sector: profile.sector });
      } else {
        io.emit("rosterUpdate", { employeeId });
      }
    } else {
      console.warn("Socket.io not initialized; cannot emit rosterUpdate event");
    }

    res.status(200).json({ message: "Leave period suggested", roster });
  } catch (error) {
    console.error("Error suggesting leave period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Confirm/Reject leave period
router.patch("/update-period/:rosterId/:periodId", verifyToken, hasRole(["Supervisor", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { rosterId, periodId } = req.params;
    const { status } = req.body;

    if (!["Confirmed", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'Confirmed' or 'Rejected'" });
    }

    const roster = await LeaveRoster.findById(rosterId);
    if (!roster) return res.status(404).json({ error: "Roster not found" });

    const period = roster.periods.id(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    period.status = status;
    await roster.save();

    const io = req.app.get("io");
    if (io) {
      const profile = await Profile.findOne({ userId: roster.employeeId });
      if (profile && profile.sector) {
        io.to(`sector:${profile.sector}`).emit("rosterUpdate", { employeeId: roster.employeeId, periodId, status, sector: profile.sector });
      } else {
        io.emit("rosterUpdate", { employeeId: roster.employeeId, periodId, status });
      }
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
    if (["Short Leave", "Emergency Leave", "Compassionate", "Sports"].includes(leaveType)) {
      leave = new ShortLeave({
        employeeId: roster.employeeId._id,
        leaveType,
        employeeName: roster.employeeId.name,
        personNumber: "N/A",
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: `${leaveType} applied from roster`,
        status: "Pending",
      });
    } else if (["Annual Leave", "Maternity Leave", "Terminal", "Unpaid"].includes(leaveType)) {
      leave = new AnnualLeave({
        employeeId: roster.employeeId._id,
        leaveType,
        employeeName: roster.employeeId.name,
        personNumber: "N/A",
        department: roster.department,
        daysApplied: countWorkingDays(new Date(startDate), new Date(endDate)),
        startDate,
        endDate,
        reason: `${leaveType} applied from roster`,
        status: "Pending",
        approvals: [
          { approverRole: "Sectional Head", status: "Pending" },
          { approverRole: "Departmental Head", status: "Pending" },
          { approverRole: "HR Director", status: "Pending" },
        ],
      });
    } else {
      return res.status(400).json({ error: "Unsupported leave type" });
    }

    await leave.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("newLeaveRequest", {
        leaveType: leave.leaveType,
        employeeName: leave.employeeName,
        id: leave._id,
      });
      const profile = await Profile.findOne({ userId: roster.employeeId });
      if (profile && profile.sector) {
        io.to(`sector:${profile.sector}`).emit("rosterUpdate", { employeeId: roster.employeeId, sector: profile.sector });
      }
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