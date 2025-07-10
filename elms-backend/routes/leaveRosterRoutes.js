const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const LeaveRoster = require("../models/LeaveRoster");
const ShortLeave = require("../models/ShortLeave");
const AnnualLeave = require("../models/AnnualLeave");
const Profile = require("../models/Profile");
const User = require("../models/User");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/auditLogger");

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

router.get("/suggested", verifyToken, hasRole([ "Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  console.log("Matched /suggested route with query:", req.query);
  try {
    const { directorate, department } = req.query;
    let query = {};
    if (directorate) query.directorate = directorate;
    if (department) query.department = department;
    const rosters = await LeaveRoster.find(query)
      .populate("employeeId", "name")
      .where("periods.status", "Suggested");
      logAction("Viewed suggested leaves", req.user, { directorate, department });
    res.status(200).json(rosters);
  } catch (error) {
    console.error("Error fetching suggested leaves:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.put("/suggested", verifyToken, hasRole(["Director", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { rosterId, periodId, startDate, endDate } = req.body;
    const roster = await LeaveRoster.findById(rosterId);
    if (!roster) return res.status(404).json({ error: "Roster not found" });

    const period = roster.periods.id(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    period.startDate = new Date(startDate);
    period.endDate = new Date(endDate);
    period.status = "Suggested";
    await roster.save();

    const io = req.app.get("io");
    if (io) {
      const profile = await Profile.findOne({ userId: roster.employeeId });
      if (profile && profile.directorate) {
        io.to(`directorate:${profile.directorate}`).emit("rosterUpdate", { employeeId: roster.employeeId, directorate: profile.directorate });
      }
    }
     logAction("Updated suggested period", req.user, { rosterId, periodId, startDate, endDate });
    res.status(200).json({ message: "Suggested period updated", roster });
  } catch (error) {
    console.error("Error updating suggested period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.get("/employee/:employeeId", verifyToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ error: "Invalid employeeId" });
    }
    const year = new Date().getFullYear();
    const roster = await LeaveRoster.findOne({ employeeId, year }).populate("employeeId", "name department");
    if (!roster) {
      return res.status(404).json({ error: "Leave roster not found" });
    }
     logAction("Viewed employee leave roster", req.user, { employeeId, year });
    res.status(200).json(roster);
  } catch (error) {
    console.error("Error fetching employee leave roster:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.get("/:employeeId", verifyToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ error: "Invalid employeeId" });
    }
    const year = new Date().getFullYear();

    if (req.user.id !== employeeId && !["Admin", "Director", "DepartmentalHead", "HRDirector"].includes(req.user.role)) {
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
    logAction("Accessed employee roster", req.user, { employeeId, year });
    res.status(200).json(roster);
  } catch (error) {
    console.error("Error fetching leave roster:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.get("/directorate/:directorate", verifyToken, async (req, res) => {
  try {
    const { directorate } = req.params;
    const { department } = req.query;
    const year = new Date().getFullYear();

    let query = { directorate };
    if (department) {
      query.department = department;
    }

    const profiles = await Profile.find({ directorate });
    const employeeIds = profiles.map(profile => profile.userId);

    const rosters = await LeaveRoster.find({ 
      employeeId: { $in: employeeIds }, 
      year 
    }).populate("employeeId", "name department");
     logAction("Viewed directorate rosters", req.user, { directorate, department });
    res.status(200).json(rosters);
  } catch (error) {
    console.error("Error fetching leave rosters for directorate:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Admin-specific directorate roster fetch with month filtering (used by AdminLeaveRoster)
router.get("/directorate/:directorate/admin", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { directorate } = req.params;
    const { department, month } = req.query;

    if (!directorate) {
      return res.status(400).json({ error: "Directorate is required" });
    }

    let query = { directorate };
    if (department) {
      query.department = department;
    }

    let rosters = await LeaveRoster.find(query).populate("employeeId", "name");

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0);

      rosters = rosters.map(roster => {
        const filteredPeriods = roster.periods.filter(period => {
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          return startDate <= monthEnd && endDate >= monthStart;
        });
        return { ...roster.toObject(), periods: filteredPeriods };
      }).filter(roster => roster.periods.length > 0);
    }

    const formattedRosters = rosters.map(roster => ({
      employeeId: roster.employeeId,
      employee: roster.employeeId.name,
      periods: roster.periods,
      directorate: roster.directorate,
      department: roster.department,
    }));

    if (req.app.get("io")) {
      req.app.get("io").to(`directorate:${directorate}`).emit("rosterUpdate", { directorate, department });
    }
   logAction("Viewed admin directorate rosters", req.user, { directorate, department, month });
    res.status(200).json(formattedRosters);
  } catch (error) {
    console.error("Error fetching leave roster:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});


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
      "Terminal Leave", "Compassionate Leave", "Sports Leave", "Unpaid Leave"
    ];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({ error: `leaveType must be one of: ${validLeaveTypes.join(", ")}` });
    }

    if (req.user.id !== employeeId && !["Director", "HRDirector", "Admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized to suggest leave for this employee" });
    }

    let roster = await LeaveRoster.findOne({ employeeId, year }).populate("employeeId", "department");
    if (!roster) {
      const employee = await User.findById(employeeId);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const profile = await Profile.findOne({ userId: employeeId });
      if (!profile) {
        return res.status(400).json({ error: "Employee profile not found" });
      }

      const department = profile.department || employee.department;
      const directorate = profile.directorate || req.user.directorate;

      if (!department || !directorate) {
        return res.status(400).json({ error: "Employee department and directorate are required but not set" });
      }

      roster = new LeaveRoster({
        employeeId,
        year,
        department,
        directorate,
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
      if (profile && profile.directorate) {
        io.to(`directorate:${profile.directorate}`).emit("rosterUpdate", { employeeId, directorate: profile.directorate });
      } else {
        io.emit("rosterUpdate", { employeeId });
      }
    } else {
      console.warn("Socket.io not initialized; cannot emit rosterUpdate event");
    }
   logAction("Suggested leave period", req.user, { employeeId, startDate, endDate, leaveType });
    res.status(200).json({ message: "Leave period suggested", roster });
  } catch (error) {
    console.error("Error suggesting leave period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.post("/counter-suggest/:employeeId/:periodId", verifyToken, hasRole(["Director", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { employeeId, periodId } = req.params;
    const { startDate, endDate } = req.body;

    const roster = await LeaveRoster.findOne({ employeeId });
    if (!roster) return res.status(404).json({ error: "Roster not found" });

    const period = roster.periods.id(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    period.startDate = new Date(startDate);
    period.endDate = new Date(endDate);
    period.status = "Counter-Suggested";
    await roster.save();

    const io = req.app.get("io");
    if (io) {
      const profile = await Profile.findOne({ userId: employeeId });
      if (profile && profile.directorate) {
        io.to(`directorate:${profile.directorate}`).emit("rosterUpdate", { employeeId, directorate: profile.directorate });
      }
    }
     logAction("Counter-suggested leave period", req.user, { employeeId, periodId, startDate, endDate });
    res.status(200).json({ message: "Leave period counter-suggested", roster });
  } catch (error) {
    console.error("Error counter-suggesting leave period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.patch("/update-period/:rosterId/:periodId", verifyToken, hasRole(["Director", "HRDirector", "Admin"]), async (req, res) => {
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
      if (profile && profile.directorate) {
        io.to(`directorate:${profile.directorate}`).emit("rosterUpdate", { employeeId: roster.employeeId, periodId, status, directorate: profile.directorate });
      } else {
        io.emit("rosterUpdate", { employeeId: roster.employeeId, periodId, status });
      }
    } else {
      console.warn("Socket.io not initialized; cannot emit rosterUpdate event");
    }
     logAction("Updated leave period status", req.user, { rosterId, periodId, status });
    res.status(200).json({ message: "Leave period updated", roster });
  } catch (error) {
    console.error("Error updating leave period:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

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
    if (["Short Leave", "Emergency Leave", "Compassionate Leave", "Sports Leave"].includes(leaveType)) {
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
    } else if (["Annual Leave", "Maternity Leave", "Terminal Leave", "Unpaid Leave"].includes(leaveType)) {
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
          { approverRole: "Director", status: "Pending" },
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
      if (profile && profile.directorate) {
        io.to(`directorate:${profile.directorate}`).emit("rosterUpdate", { employeeId: roster.employeeId, directorate: profile.directorate });
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

router.get("/admin", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { directorate, department } = req.query;
    let query = {};
    if (directorate) query.directorate = directorate;
    if (department) query.department = department;

    const rosters = await LeaveRoster.find(query).populate("employeeId", "name");
     logAction("Viewed admin rosters", req.user, { directorate, department });
    res.status(200).json(
      rosters.map((r) => ({
        _id: r._id,
        employeeName: r.employeeId.name,
        requestedPeriod: r.requestedPeriod,
        status: r.status,
        directorate: r.directorate,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id/suggest", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { suggestedPeriod } = req.body;
    const roster = await LeaveRoster.findByIdAndUpdate(
      req.params.id,
      { suggestedPeriod, status: "Counter-Suggested" },
      { new: true }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`directorate:${roster.directorate}`).emit("rosterUpdate", {
        directorate: roster.directorate,
      });
    }
     logAction("Suggested counter period", req.user, { rosterId: req.params.id, suggestedPeriod });
    res.status(200).json(roster);
  } catch (error) {
    res.status(500).json({ error: "Failed to update roster" });
  }
});

module.exports = router;