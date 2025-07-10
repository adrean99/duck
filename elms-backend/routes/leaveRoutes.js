const express = require("express");
const router = express.Router();
const ShortLeave = require("../models/ShortLeave");
const AnnualLeave = require("../models/AnnualLeave");
const mongoose = require("mongoose");
const sendEmail = require("../utils/emailService");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");
const User = require("../models/User");
const LeaveBalance = require("../models/LeaveBalance");
const { logAction } = require("../utils/auditLogger");

// Utility function to count working days
const countWorkingDays = (start, end) => {
  let count = 0;
  let current = new Date(start);
  const holidays = [new Date("2025-01-01")];

  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6 && !holidays.some(h => h.toDateString() === current.toDateString())) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
};

// Apply for leave (Employee)
router.post("/apply", verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(401).json({ error: "Invalid or missing user ID" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ error: "User not found" });

    const {
      leaveType, chiefOfficerName, directorName, employeeName, personNumber,
      department, daysApplied, startDate, endDate, reason, assignedToName,
      assignedToDesignation, recommendation, directorate, addressWhileAway,
      emailAddress, phoneNumber, leaveBalanceBF, currentYearLeave,
      leaveTakenThisYear, computedBy, departmentalHeadName, HRDirectorName
    } = req.body;

    let leaveBalance = await LeaveBalance.findOne({ userId: req.user.id });
    if (!leaveBalance) {
      leaveBalance = new LeaveBalance({
        userId: req.user.id,
        year: new Date().getFullYear(),
        leaveBalanceBF: 0,
        currentYearLeave: 30,
        leaveTakenThisYear: 0,
      });
      await leaveBalance.save();
    }

    const totalLeaveDays = leaveBalance.leaveBalanceBF + leaveBalance.currentYearLeave;
    const leaveBalanceDue = totalLeaveDays - leaveBalance.leaveTakenThisYear;
    if (daysApplied > leaveBalanceDue) {
      return res.status(400).json({ error: "Insufficient leave balance" });
    }

    if (!leaveType || !startDate || !reason || !employeeName || !personNumber || !department || !daysApplied) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setUTCHours(0, 0, 0, 0);

    let leave;
    if (leaveType === "Short Leave") {
      if (!chiefOfficerName || !directorName || !daysApplied || !end) {
        return res.status(400).json({ error: "Required fields missing for Short Leave" });
      }
      const workingDays = countWorkingDays(start, end);
      if (workingDays > 5 || workingDays !== daysApplied) {
        return res.status(400).json({ error: `Short leave must be 1-5 working days (${workingDays} calculated)` });
      }

      leave = new ShortLeave({
        employeeId: req.user.id, leaveType: "Short Leave", chiefOfficerName,
        directorName, employeeName, personNumber, department, daysApplied,
        startDate: start, endDate: end, reason, assignedToName,
        assignedToDesignation, recommendation, status: "Pending",
        directorate: user.directorate, currentApprover: "Director"
      });
    } else if (leaveType === "Annual Leave") {
      if (!Number.isInteger(daysApplied) || daysApplied <= 0 || daysApplied > 30) {
        return res.status(400).json({ error: "Days applied must be between 1 and 30" });
      }
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (start - today < 7 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "Annual leave must be submitted 7 days in advance" });
      }
      const workingDays = countWorkingDays(start, end);
      if (workingDays !== daysApplied) {
        return res.status(400).json({ error: `Days applied (${daysApplied}) must match working days (${workingDays})` });
      }

      leave = new AnnualLeave({
        employeeId: req.user.id, leaveType: "Annual Leave", employeeName,
        personNumber, department, directorate: user.directorate, daysApplied,
        startDate: start, endDate: end, addressWhileAway, emailAddress,
        phoneNumber, reason, leaveBalanceBF: leaveBalanceBF || 0,
        currentYearLeave: currentYearLeave || 0, totalLeaveDays,
        leaveTakenThisYear: leaveTakenThisYear || 0, leaveBalanceDue,
        leaveApplied: daysApplied, leaveBalanceCF: leaveBalanceDue - daysApplied,
        computedBy, computedDate: computedBy ? new Date() : undefined,
        directorName, departmentalHeadName, HRDirectorName,
        status: "Pending", currentApprover: "Director"
      });
    } else {
      return res.status(400).json({ error: "Invalid leave type" });
    }

    await leave.save();
    const io = req.app.get("io");
    if (io) {
      io.emit("newLeaveRequest", { leaveType: leave.leaveType, employeeName: leave.employeeName, id: leave._id });
    }

    const adminEmail = (await User.findOne({ role: "Admin" }))?.email || "admin@example.com";
    await sendEmail(adminEmail, "New Leave Request", `New ${leave.leaveType} request from ${leave.employeeName}.`);
    logAction("Applied for leave", req.user, { leaveId: leave._id, leaveType, daysApplied, startDate, endDate });
    res.status(201).json({ message: "Leave request submitted", leave });
  } catch (error) {
    console.error("Error applying for leave:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get admin leaves with directorate filter
router.get(
  "/admin/leaves",
  verifyToken,
  hasRole(["Admin", "Director", "DepartmentalHead", "HRDirector"]),
  async (req, res) => {
    try {
      const { leaveType } = req.query;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      let leaveRequests;

      if (leaveType === "Short Leave") {
        // Fetch short leaves and populate employeeId to get directorate/department
        leaveRequests = await ShortLeave.find().populate('employeeId', 'directorate department').sort({ createdAt: -1 });

        // Filter based on user's role
        if (user.role === "Director" && user.directorate) {
          leaveRequests = leaveRequests.filter(leave => leave.employeeId?.directorate === user.directorate);
        } else if (user.role === "DepartmentalHead" && user.department) {
          leaveRequests = leaveRequests.filter(leave => leave.employeeId?.department === user.department);
        }
      } else if (leaveType === "Annual Leave") {
        let query = {};
        if (user.role === "Director" && user.directorate) {
          query.directorate = user.directorate;
        } else if (user.role === "DepartmentalHead" && user.department) {
          query.department = user.department;
        }
        leaveRequests = await AnnualLeave.find(query).sort({ createdAt: -1 });
      } else {
        return res.status(400).json({ error: "Invalid leave type" });
      }
      logAction("Viewed admin leaves", req.user, { leaveType, directorate: user.directorate, department: user.department });
      res.status(200).json(leaveRequests);
    } catch (error) {
      console.error("Error fetching admin leaves:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

// Approve leave with fixed workflow
router.patch("/approve/:id", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    // Fetch leave and determine type
    let leave = await ShortLeave.findById(id);
    const isShortLeave = !!leave;
    if (!leave) {
      leave = await AnnualLeave.findById(id);
    }
    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    console.log("Leave document:", leave.toObject());

    // Validate status
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'Approved' or 'Rejected'" });
    }

    // Define approval sequence
    const approvalSequence = ["Director", "DepartmentalHead", "HRDirector"];
    const currentIndex = approvalSequence.indexOf(leave.currentApprover || "Director");
    const userIndex = approvalSequence.indexOf(req.user.role);

    // Enforce approval sequence unless Admin
    if (req.user.role !== "Admin" && (userIndex !== currentIndex || userIndex < 0)) {
      return res.status(403).json({ error: "Not your turn to approve or invalid role" });
    }

    // Initialize approvals array if not present
    if (!leave.approvals) leave.approvals = [];

    // Find or create approval entry
    const approvalIndex = leave.approvals.findIndex(a => a.approverRole === req.user.role);
    let approval;
    if (approvalIndex !== -1) {
      approval = leave.approvals[approvalIndex];
      console.log("Existing approval:", approval);
      if (approval.status !== "Pending") {
        return res.status(400).json({ error: `${req.user.role} has already approved or rejected` });
      }
    } else {
      approval = { approverRole: req.user.role, status: "Pending", comment: "", updatedAt: new Date() };
      leave.approvals.push(approval);
    }

    // Update approval
    approval.status = status;
    approval.comment = comment || "";
    approval.updatedAt = new Date();

    // Update workflow
   const now = new Date();
    let progress = 0;
    if (req.user.role === "Director") {
      leave.directorDate = now;
      leave.directorRecommendation = status === "Approved" ? "Recommended" : "Rejected"; // Add recommendation
      leave.currentApprover = status === "Approved" ? "DepartmentalHead" : null;
      progress = status === "Approved" ? 33 : 0;
    } else if (req.user.role === "DepartmentalHead") {
      if (!leave.approvals.some(a => a.approverRole === "Director" && a.status === "Approved")) {
        return res.status(400).json({ error: "Director approval is required first" });
      }
      leave.departmentalHeadDate = now;
      leave.departmentalHeadRecommendation = status === "Approved" ? "Recommended" : "Rejected";
      leave.currentApprover = status === "Approved" ? "HRDirector" : null;
      progress = status === "Approved" ? 66 : 0;
    } else if (req.user.role === "HRDirector") {
      if (!leave.approvals.some(a => a.approverRole === "DepartmentalHead" && a.status === "Approved")) {
        return res.status(400).json({ error: "Departmental Head approval is required first" });
      }
      leave.HRDirectorDate = now;
      leave.approverRecommendation = status === "Approved" ? "Recommended" : "Rejected";
      leave.currentApprover = null;
      leave.status = status;
      progress = 100;
    } else if (req.user.role === "Admin") {
      leave.currentApprover = null;
      leave.status = status;
      progress = 100;
    }

    // Determine overall status
    if (leave.approvals.some(a => a.status === "Rejected")) {
      leave.status = "Rejected";
      leave.currentApprover = null;
      progress = 0;
    } else if (leave.currentApprover === null && leave.status !== "Rejected") {
      leave.status = "Approved";
    }

    // Save the document
    await leave.save();

    // Update leave balance if fully approved
    if (leave.status === "Approved") {
      const leaveBalance = await LeaveBalance.findOne({ userId: leave.employeeId });
      if (leaveBalance) {
        leaveBalance.leaveTakenThisYear += leave.daysApplied;
        await leaveBalance.save();
      }
    }

    // Notify employee
    const employee = await User.findById(leave.employeeId);
    const notificationMessage = `Your ${leave.leaveType} request has been ${status.toLowerCase()} by ${req.user.role} on ${now.toLocaleString()}. Comment: ${comment || "None"}`;
    await sendEmail(employee.email, "Leave Status Update", notificationMessage);

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("leaveStatusUpdate", {
        id: leave._id,
        status: leave.status,
        currentApprover: leave.currentApprover,
        approvals: leave.approvals,
        progress,
      });
    }

    logAction("Approved/Rejected leave", req.user, { leaveId: leave._id, leaveType: leave.leaveType, status, comment });
    res.status(200).json({ message: "Leave status updated", leave });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Approve leave with fixed workflow
/*router.patch("/approve/:id", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    // Fetch leave and determine type
    let leave = await ShortLeave.findById(id);
    const isShortLeave = !!leave;
    if (!leave) {
      leave = await AnnualLeave.findById(id);
    }
    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    // Define approval sequence
    const approvalSequence = ["Director", "DepartmentalHead", "HRDirector"];
    const currentIndex = approvalSequence.indexOf(leave.currentApprover || "Director");
    const userIndex = approvalSequence.indexOf(req.user.role);

    // Enforce sequence and role check
    if (req.user.role !== "Admin" && (userIndex !== currentIndex || userIndex < 0)) {
      return res.status(403).json({ error: "Not your turn to approve or invalid role" });
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'Approved' or 'Rejected'" });
    }

    // Initialize approvals array if not present
    if (!leave.approvals) leave.approvals = [];
    const approval = leave.approvals.find(a => a.approverRole === req.user.role) || {
      approverRole: req.user.role,
      status: "Pending",
      comment: "",
      updatedAt: new Date(),
    };
    if (!leave.approvals.includes(approval)) leave.approvals.push(approval);

    // Update approval
    approval.status = status;
    approval.comment = comment || "";
    approval.updatedAt = new Date();

    // Update workflow and progress
    const now = new Date();
    let progress = 0;
    if (req.user.role === "Director") {
      if (leave.approvals.some(a => a.approverRole === "Director" && a.status !== "Pending")) {
        return res.status(400).json({ error: "Director has already approved or rejected" });
      }
      leave.directorDate = now;
      leave.currentApprover = status === "Approved" ? "DepartmentalHead" : null;
      progress = status === "Approved" ? 33 : 0;
    } else if (req.user.role === "DepartmentalHead") {
      if (!leave.approvals.some(a => a.approverRole === "Director" && a.status === "Approved")) {
        return res.status(400).json({ error: "Director approval is required first" });
      }
      if (leave.approvals.some(a => a.approverRole === "DepartmentalHead" && a.status !== "Pending")) {
        return res.status(400).json({ error: "Departmental Head has already approved or rejected" });
      }
      leave.departmentalHeadDate = now;
      leave.currentApprover = status === "Approved" ? "HRDirector" : null;
      progress = status === "Approved" ? 66 : 0;
    } else if (req.user.role === "HRDirector") {
      if (!leave.approvals.some(a => a.approverRole === "DepartmentalHead" && a.status === "Approved")) {
        return res.status(400).json({ error: "Departmental Head approval is required first" });
      }
      if (leave.approvals.some(a => a.approverRole === "HRDirector" && a.status !== "Pending")) {
        return res.status(400).json({ error: "HR Director has already approved or rejected" });
      }
      leave.HRDirectorDate = now;
      leave.currentApprover = null;
      leave.status = status;
      progress = 100;
    } else if (req.user.role === "Admin") {
      leave.currentApprover = null;
      leave.status = status;
      progress = 100;
    }

    // Set overall status based on approvals
    if (leave.approvals.some(a => a.status === "Rejected")) {
      leave.status = "Rejected";
      leave.currentApprover = null;
      progress = 0;
    } else if (leave.currentApprover === null && leave.status !== "Rejected") {
      leave.status = "Approved";
    }

    await leave.save();

    // Update leave balance if approved
    if (leave.status === "Approved") {
      const leaveBalance = await LeaveBalance.findOne({ userId: leave.employeeId });
      if (leaveBalance) {
        leaveBalance.leaveTakenThisYear += leave.daysApplied;
        await leaveBalance.save();
      }
    }

    // Notify employee
    const employee = await User.findById(leave.employeeId);
    const notificationMessage = `Your ${leave.leaveType} request has been ${status.toLowerCase()} by ${req.user.role} on ${now.toLocaleString()}. Comment: ${comment || "None"}`;
    await sendEmail(employee.email, "Leave Status Update", notificationMessage);

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("leaveStatusUpdate", { id: leave._id, status: leave.status, progress, currentApprover: leave.currentApprover, approvals: leave.approvals });
    }

    logAction("Approved/Rejected leave", req.user, { leaveId: leave._id, leaveType: leave.leaveType, status, comment });
    res.status(200).json({ message: "Leave status updated", leave });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});
*/
// Get own leave requests (Employee)
// GET /api/leaves/my-leaves
router.get("/my-leaves", verifyToken, async (req, res) => {
  try {
    const { leaveType } = req.query;
    console.log("Fetching leaves for user:", req.user.id, "with leaveType:", leaveType);
    const currentDate = new Date();

    // Auto-reject overdue pending leaves
    if (leaveType === "Short Leave") {
      await ShortLeave.updateMany(
        {
          employeeId: req.user.id,
          status: "Pending",
          startDate: { $lte: currentDate },
        },
        { status: "Rejected" }
      );
    } else if (leaveType === "Annual Leave") {
      await AnnualLeave.updateMany(
        {
          employeeId: req.user.id,
          status: "Pending",
          startDate: { $lte: currentDate },
        },
        { status: "Rejected" }
      );
    }
    let leaveRequests;

    if (leaveType === "Short Leave") {
      leaveRequests = await ShortLeave.find({ employeeId: req.user.id }).sort({ createdAt: -1 });
    } else if (leaveType === "Annual Leave") {
      leaveRequests = await AnnualLeave.find({ employeeId: req.user.id }).sort({ createdAt: -1 });
    } else {
      return res.status(400).json({ error: "Invalid leave type" });
    }

    console.log("Leave requests for user:", req.user.id, leaveRequests);
     logAction("Viewed my leave requests", req.user, { leaveType });
    res.status(200).json(leaveRequests);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.get("/pending-approvals", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {


    let leaveRequests = [];
    if (req.user.role === "Director" || req.user.role === "Admin") {
      const shortLeaves = await ShortLeave.find({ status: "Pending" }).sort({ createdAt: -1 });
      leaveRequests = [...leaveRequests, ...shortLeaves];
    }
    if (["Director", "DepartmentalHead", "HRDirector", "Admin"].includes(req.user.role)) {
      const annualLeaves = await AnnualLeave.find({
        "approvals": { $elemMatch: { approverRole: req.user.role, status: "Pending" } },
      }).sort({ createdAt: -1 });
      leaveRequests = [...leaveRequests, ...annualLeaves];
    }
    res.status(200).json(leaveRequests);
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

/*router.patch("/approve/:id", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    let leave = await ShortLeave.findById(id);
    let isShortLeave = !!leave;
    if (!leave) {
      leave = await AnnualLeave.findById(id);
      console.log("Loaded AnnualLeave (raw):", leave); // Log the raw document
    }
    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    console.log("User role:", req.user.role); // Debug user role

    if (isShortLeave) {
      if (req.user.role === "Director" || req.user.role === "HRDirector" || req.user.role === "Admin") {
        leave.status = status;
        leave.recommendation = comment || leave.recommendation;
      } else {
        return res.status(403).json({ error: "Only Director, HRDirector, or Admin can approve Short Leave" });
      }
      await leave.save();
      console.log("Saved ShortLeave:", leave);
    } else {
      const approval = leave.approvals.find(a => a.approverRole === req.user.role && a.status === "Pending");
      console.log("Found approval for role:", req.user.role, "Approval:", approval); // Debug approval
      if (!approval && req.user.role !== "Admin") {
        return res.status(403).json({ error: `Not authorized as ${req.user.role}` });
      }
      if (approval) {
        approval.status = status;
        approval.comment = comment || "";
        approval.updatedAt = Date.now();
      } else if (req.user.role === "Admin") {
        // Allow Admin to override status directly
        leave.status = status;
      }
      await leave.save();
      console.log("Saved AnnualLeave:", leave);
    }

    if (leave.status === "Approved") {
      const leaveBalance = await LeaveBalance.findOne({ userId: leave.employeeId });
      if (leaveBalance) {
        const currentYear = new Date().getFullYear();
        const approvedLeaves = [
          ...(await ShortLeave.find({
            employeeId: leave.employeeId,
            status: "Approved",
            startDate: { $gte: new Date(currentYear, 0, 1), $lte: new Date(currentYear, 11, 31) },
          })),
          ...(await AnnualLeave.find({
            employeeId: leave.employeeId,
            status: "Approved",
            startDate: { $gte: new Date(currentYear, 0, 1), $lte: new Date(currentYear, 11, 31) },
          })),
        ];
        leaveBalance.leaveTakenThisYear = approvedLeaves.reduce((sum, l) => sum + (l.daysApplied || 0), 0);
        await leaveBalance.save();
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("leaveStatusUpdate", { id: leave._id, status: leave.status });
    }

    const employee = await User.findById(leave.employeeId);
    const employeeEmail = employee?.email || "employee@example.com";
    await sendEmail(employeeEmail, "Leave Status Update", `Your ${leave.leaveType} request has been ${leave.status.toLowerCase()}. Comment: ${comment || "None"}`);
logAction("Approved/Rejected leave (alternative)", req.user, { leaveId: leave._id, leaveType: leave.leaveType, status, comment });
    res.status(200).json({ message: "Leave status updated", leave });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});
*/

router.patch("/admin/leaves/:id", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; 
    console.log("Admin updating leave:", id, "with updates:", updates, "by role:", req.user.role);

    let leave = await ShortLeave.findById(id);
    let isShortLeave = !!leave;
    if (!leave) {
      leave = await AnnualLeave.findById(id);
    }
    if (!leave) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    const allowedUpdates = {
      Director: ["directorRecommendation", "directorDate"],
      DepartmentalHead: [
        "departmentalHeadRecommendation",
        "departmentalHeadDate",
        "departmentalHeadDaysGranted",
        "departmentalHeadStartDate",
        "departmentalHeadLastDate",
        "departmentalHeadResumeDate",
      ],
      HRDirector: ["approverRecommendation", "approverDate"],
      Admin: [
        "directorRecommendation",
        "directorDate",
        "departmentalHeadRecommendation",
        "departmentalHeadDate",
        "departmentalHeadDaysGranted",
        "departmentalHeadStartDate",
        "departmentalHeadLastDate",
        "departmentalHeadResumeDate",
        "approverRecommendation",
        "approverDate",
      ],
    };

    const userRole = req.user.role;
    const allowedFields = allowedUpdates[userRole];
    if (!allowedFields) {
      return res.status(403).json({ error: `Role ${userRole} not authorized to update leave` });
    }

    if (isShortLeave && !["Director", "HRDirector", "Admin"].includes(userRole)) {
      return res.status(403).json({ error: "Only Director, HRDirector, or Admin can update Short Leave" });
    }

    // Filter updates to only allowed fields
    const filteredUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update" });
    }

    if ((userRole === "HRDirector" || userRole === "Admin") && "approverRecommendation" in filteredUpdates) {
      filteredUpdates.status = filteredUpdates.approverRecommendation === "Approved" ? "Approved" : "Rejected";
      if (filteredUpdates.status === "Approved") {
        const leaveBalance = await LeaveBalance.findOne({ userId: leave.employeeId });
        if (leaveBalance) {
          const currentYear = new Date().getFullYear();
          const approvedLeaves = [
            ...(await ShortLeave.find({
              employeeId: leave.employeeId,
              status: "Approved",
              startDate: { $gte: new Date(currentYear, 0, 1), $lte: new Date(currentYear, 11, 31) },
            })),
            ...(await AnnualLeave.find({
              employeeId: leave.employeeId,
              status: "Approved",
              startDate: { $gte: new Date(currentYear, 0, 1), $lte: new Date(currentYear, 11, 31) },
            })),
          ];
          leaveBalance.leaveTakenThisYear = approvedLeaves.reduce((sum, l) => sum + (l.daysApplied || 0), 0);
          await leaveBalance.save();
        }
      }
    }

    Object.assign(leave, filteredUpdates);
    await leave.save();

    console.log("Leave updated:", leave);
 logAction("Updated leave details", req.user, { leaveId: leave._id, updates: filteredUpdates });
    res.status(200).json({ message: "Leave updated successfully", leave });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});



router.get("/approved", verifyToken, async (req, res) => {
  try {
    const shortLeaves = await ShortLeave.find({ status: "Approved" }).populate("employeeId", "name");
    const annualLeaves = await AnnualLeave.find({ status: "Approved" }).populate("employeeId", "name");
    const leaves = [...shortLeaves, ...annualLeaves];
    res.json(leaves);
  } catch (error) {
    console.error("Error fetching approved leaves:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get approved leaves with directorate and department filters
router.get("/approved", verifyToken, async (req, res) => {
  const { month, employeeId, directorate, department } = req.query;

  // Validate month format (YYYY-MM)
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Invalid month format. Use YYYY-MM" });
  }

  try {
    const date = month ? parse(month, "yyyy-MM", new Date()) : new Date();
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    // Build query
    let query = {
      status: "Approved",
      $or: [
        { startDate: { $lte: monthEnd, $gte: monthStart } }, // Fully within month
        { endDate: { $gte: monthStart, $lte: monthEnd } },   // Overlaps start or end
        { $and: [{ startDate: { $lte: monthStart } }, { endDate: { $gte: monthEnd } }] }, // Spans the month
      ],
    };

    // Handle employeeId for non-admins
    if (employeeId && req.user.role !== "Admin") {
      if (req.user.id !== employeeId) {
        return res.status(403).json({ error: "Unauthorized: Can only view your own leaves" });
      }
      query.employeeId = employeeId;
    } else if (req.user.role !== "Admin" && !employeeId) {
      return res.status(403).json({ error: "Unauthorized: employeeId required" });
    }

    // Add directorate and department filters for admins
    if (["Admin"].includes(req.user.role)) {
      if (directorate) {
        const profiles = await Profile.find({ directorate }).lean();
        query.employeeId = { $in: profiles.map(p => p.userId) };
      }
      if (department) {
        const profiles = await Profile.find({ department }).lean();
        query.employeeId = query.employeeId ? { $in: [...new Set([...(query.employeeId.$in || []), ...profiles.map(p => p.userId)])] } : { $in: profiles.map(p => p.userId) };
      }
    }

    // Find approved leaves
    const [shortLeaves, annualLeaves] = await Promise.all([
      ShortLeave.find(query).lean(),
      AnnualLeave.find(query).lean(),
    ]);

    // Map leave types
    const mapLeaveType = (leaveType) => {
      const typeMap = {
        "Short Leave": "Vacation Leave",
        "Annual Leave": "Vacation Leave",
        "Emergency Leave": "Compassionate Leave",
        "Maternity Leave": "Maternity or Paternity",
        "Terminal": "Terminal Leave",
        "Compassionate": "Compassionate Leave",
        "Sports": "Sports Leave",
        "Unpaid": "Unpaid Leave",
      };
      return typeMap[leaveType] || leaveType;
    };

    const mappedLeaves = [...shortLeaves, ...annualLeaves].map(leave => ({
      ...leave,
      leaveType: mapLeaveType(leave.leaveType),
    }));

    res.status(200).json(mappedLeaves);
  } catch (error) {
    console.error("Error fetching approved leaves:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.get("/employee", verifyToken, async (req, res) => {
  try {
    console.log("Fetching all leaves for employee:", req.user.id);

    // Auto-reject overdue pending leaves
    const currentDate = new Date();
    await ShortLeave.updateMany(
      {
        employeeId: req.user.id,
        status: "Pending",
        startDate: { $lte: currentDate },
      },
      { status: "Rejected" }
    );
    await AnnualLeave.updateMany(
      {
        employeeId: req.user.id,
        status: "Pending",
        startDate: { $lte: currentDate },
      },
      { status: "Rejected" }
    );

    // Fetch all Short Leave and Annual Leave requests for the employee
    const shortLeaves = await ShortLeave.find({ employeeId: req.user.id }).populate("employeeId", "name");
    const annualLeaves = await AnnualLeave.find({ employeeId: req.user.id }).populate("employeeId", "name");

    // Combine and sort by createdAt (newest first)
    const allLeaves = [...shortLeaves, ...annualLeaves].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    console.log("Fetched leaves for employee:", allLeaves);
    res.status(200).json(allLeaves);
  } catch (error) {
    console.error("Error fetching employee leaves:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

//GET /api/leaves/admin/leaves
router.get(
  "/admin/leaves",
  verifyToken,
  hasRole(["Admin", "Director", "DepartmentalHead", "HRDirector"]),
  async (req, res) => {
    try {
      const { leaveType, directorate, department } = req.query;
      const userRole = req.user.role;
      const userDirectorate = req.user.directorate;
      const userDepartment = req.user.department;

      // Validate leaveType
      if (!["Short Leave", "Annual Leave"].includes(leaveType)) {
        return res.status(400).json({ error: "Invalid leave type" });
      }

      let filters = {};

      // Apply role-based filtering
      if (userRole === "Director") {
        if (!userDirectorate) {
          return res.status(400).json({ error: "Director does not have a directorate assigned" });
        }
        filters.directorate = userDirectorate; // Always filter by Director's directorate
      } else if (userRole === "DepartmentalHead") {
        if (!userDepartment) {
          return res.status(400).json({ error: "Departmental Head does not have a department assigned" });
        }
        filters.department = userDepartment; // Always filter by Departmental Head's department
      } else if (userRole === "HRDirector" || userRole === "Admin") {
        // Optionally filter by query parameters
        if (directorate) filters.directorate = directorate;
        if (department) filters.department = department;
      }

      let leaveRequests;
      if (leaveType === "Short Leave") {
        leaveRequests = await ShortLeave.find(filters).sort({ createdAt: -1 });
      } else if (leaveType === "Annual Leave") {
        leaveRequests = await AnnualLeave.find(filters).sort({ createdAt: -1 });
      }

      res.status(200).json(leaveRequests);
    } catch (error) {
      console.error("Error fetching admin leaves:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);


router.get("/all", verifyToken,
  hasRole(["Admin", "Director", "DepartmentalHead", "HRDirector"]),
  async (req, res) => {
  try {
  
    // Fetch all Short Leave and Annual Leave requests
    const shortLeaves = await ShortLeave.find().populate("employeeId");
    const annualLeaves = await AnnualLeave.find().populate("employeeId");

    // Combine and sort by createdAt (newest first)
    const allLeaves = [...shortLeaves, ...annualLeaves].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(allLeaves);
  } catch (error) {
    console.error("Error fetching all leave requests:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.put(
  "/annual/:id",
  verifyToken,
  hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]),
  async (req, res) => {
    const { id } = req.params;
    const { role, action, date } = req.body; // e.g., role: "Director", action: "Recommend", date: "2025-04-09"

    try {
      const leave = await AnnualLeave.findById(id);
      if (!leave) return res.status(404).json({ error: "Leave request not found" });

      // Validate role
      if (role !== req.user.role && req.user.role !== "Admin") {
        return res.status(403).json({ error: `Not authorized as ${role}` });
      }

      // Validate action
      if (!["Recommend", "Reject"].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'Recommend' or 'Reject'" });
      }

      // Update recommendation based on role
      if (role === "Director") {
        leave.directorRecommendation = action === "Recommend" ? "Recommended" : "Rejected";
        leave.directorDate = date;
      } else if (role === "Departmental Head") {
        leave.departmentalHeadRecommendation = action === "Recommend" ? "Recommended" : "Rejected";
        leave.departmentalHeadDate = date;
      } else if (role === "HR Director") {
        leave.approverRecommendation = action === "Recommend" ? "Recommended" : "Rejected";
        leave.approverDate = date;
      }

      // Update final status
      if (
        leave.directorRecommendation === "Recommended" &&
        leave.departmentalHeadRecommendation === "Recommended" &&
        leave.approverRecommendation === "Recommended"
      ) {
        leave.status = "Approved";
      } else if (
        leave.directorRecommendation === "Rejected" ||
        leave.departmentalHeadRecommendation === "Rejected" ||
        leave.approverRecommendation === "Rejected"
      ) {
        leave.status = "Rejected";
      } else {
        leave.status = "Pending";
      }

      // Update leave balance if approved
      if (leave.status === "Approved") {
        const leaveBalance = await LeaveBalance.findOne({ userId: leave.employeeId });
        if (leaveBalance) {
          const currentYear = new Date().getFullYear();
          const approvedLeaves = [
            ...(await ShortLeave.find({
              employeeId: leave.employeeId,
              status: "Approved",
              startDate: { $gte: new Date(currentYear, 0, 1), $lte: new Date(currentYear, 11, 31) },
            })),
            ...(await AnnualLeave.find({
              employeeId: leave.employeeId,
              status: "Approved",
              startDate: { $gte: new Date(currentYear, 0, 1), $lte: new Date(currentYear, 11, 31) },
            })),
          ];
          leaveBalance.leaveTakenThisYear = approvedLeaves.reduce((sum, l) => sum + (l.daysApplied || 0), 0);
          await leaveBalance.save();
        }
      }

      await leave.save();

      // Emit WebSocket event for real-time updates
      const io = req.app.get("io");
      if (io) {
        io.emit("leaveStatusUpdate", { id: leave._id, status: leave.status });
      }

      // Send email notification to employee
      const employee = await User.findById(leave.employeeId);
      const employeeEmail = employee?.email || "employee@example.com";
      await sendEmail(
        employeeEmail,
        "Leave Status Update",
        `Your ${leave.leaveType} request has been updated. Status: ${leave.status}.`
      );
        logAction("Updated annual leave", req.user, { leaveId: leave._id, role, action, date });
      res.status(200).json({ message: "Leave request updated", leave });
    } catch (error) {
      console.error("Error updating annual leave:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

//Analytics
router.get("/stats", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const shortLeaves = await ShortLeave.find();
    const annualLeaves = await AnnualLeave.find();
    const allLeaves = [...shortLeaves, ...annualLeaves];
    const stats = {
      total: allLeaves.length,
      approved: allLeaves.filter((leave) => leave.status === "Approved").length,
      rejected: allLeaves.filter((leave) => leave.status === "Rejected").length,
      pending: allLeaves.filter((leave) => leave.status === "Pending").length,
    };
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching leave stats:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Search Leaves (for SuperAdminDashboard)
router.get("/search", verifyToken, hasRole(["Admin", "Director", "DepartmentalHead", "HRDirector"]), async (req, res) => {
  try {
    const { employeeName, leaveType, status } = req.query;
    const query = {};

    if (employeeName) query.employeeName = { $regex: employeeName, $options: "i" };
    if (leaveType) query.leaveType = leaveType;
    if (status) query.status = status;

    const shortLeaves = await ShortLeave.find(query);
    const annualLeaves = await AnnualLeave.find(query);
    const allLeaves = [...shortLeaves, ...annualLeaves].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(allLeaves);
  } catch (error) {
    console.error("Error searching leaves:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.post('/bulk-action', async (req, res) => {
  try {
    const { leaveIds, action } = req.body;
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    const status = action === 'APPROVE' ? 'Approved' : 'Rejected';
    await Leave.updateMany(
      { _id: { $in: leaveIds } },
      { status }
    );
    logAction("Performed bulk leave action", req.user, { leaveIds, action, status });
    res.json({ message: `Leaves ${action.toLowerCase()}d successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/approved', verifyToken, async (req, res) => {
  try {
    const { directorate, month } = req.query;
    const userDirectorate = req.user.role === 'Admin' ? null : (directorate || req.user.directorate);
    const matchConditions = { status: 'Approved' };

    // If month is provided, filter leaves by the specified month
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      matchConditions.startDate = { $gte: startDate, $lte: endDate };
    }

    // Fetch approved leaves from ShortLeave and AnnualLeave collections
    let shortLeaves = await ShortLeave.find(matchConditions).populate('employeeId', 'name directorate');
    let annualLeaves = await AnnualLeave.find(matchConditions).populate('employeeId', 'name directorate');

    // Combine leaves from both collections
    let allLeaves = [...shortLeaves, ...annualLeaves];

    // Filter by directorate if provided (for standard users)
    if (userDirectorate) {
      allLeaves = allLeaves.filter(leave => leave.employeeId && leave.employeeId.directorate === userDirectorate);
    }

    // Format the response with necessary fields
    const formattedLeaves = allLeaves.map(leave => ({
      employeeName: leave.employeeId?.name || 'Unknown',
      leaveType: leave.leaveType || (leave instanceof ShortLeave ? 'Short Leave' : 'Annual Leave'),
      startDate: leave.startDate,
      endDate: leave.endDate,
      status: leave.status
    }));

    res.status(200).json(formattedLeaves);
  } catch (error) {
    console.error('Error fetching approved leaves:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
