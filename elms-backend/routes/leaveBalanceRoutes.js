const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const LeaveBalance = require("../models/LeaveBalance");
const ShortLeave = require("../models/ShortLeave"); // Import ShortLeave
const AnnualLeave = require("../models/AnnualLeave"); // Import AnnualLeave

// Get user's leave balance
router.get("/", verifyToken, async (req, res) => {
  try {
    let leaveBalance = await LeaveBalance.findOne({ userId: req.user.id });
    const currentYear = new Date().getFullYear();

    if (!leaveBalance) {
      leaveBalance = new LeaveBalance({
        userId: req.user.id,
        year: currentYear,
        leaveBalanceBF: 0,
        currentYearLeave: 30,
        leaveTakenThisYear: 0,
      });
    }

    // Calculate approved leaves for the current year from ShortLeave and AnnualLeave
    const approvedShortLeaves = await ShortLeave.find({
      employeeId: req.user.id, // Changed from userId to employeeId to match your models
      status: "Approved",
      startDate: {
        $gte: new Date(currentYear, 0, 1), // Jan 1
        $lte: new Date(currentYear, 11, 31), // Dec 31
      },
    });

    const approvedAnnualLeaves = await AnnualLeave.find({
      employeeId: req.user.id, // Changed from userId to employeeId
      status: "Approved",
      startDate: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 31),
      },
    });

    const calculatedLeaveTaken = [
      ...approvedShortLeaves,
      ...approvedAnnualLeaves,
    ].reduce((sum, leave) => sum + (leave.daysApplied || 0), 0);

    // Update leaveTakenThisYear if different
    if (leaveBalance.leaveTakenThisYear !== calculatedLeaveTaken) {
      leaveBalance.leaveTakenThisYear = calculatedLeaveTaken;
      await leaveBalance.save();
    }

    res.status(200).json(leaveBalance);
  } catch (error) {
    console.error("Error fetching leave balance:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Update leave balance (for admins or automatic updates)
router.put("/", verifyToken, async (req, res) => {
  try {
    const { leaveBalanceBF, currentYearLeave, leaveTakenThisYear } = req.body;
    let leaveBalance = await LeaveBalance.findOne({ userId: req.user.id });
    if (!leaveBalance) {
      leaveBalance = new LeaveBalance({
        userId: req.user.id,
        year: new Date().getFullYear(),
        leaveBalanceBF: leaveBalanceBF || 0,
        currentYearLeave: currentYearLeave || 30,
        leaveTakenThisYear: leaveTakenThisYear || 0,
      });
    } else {
      if (leaveBalanceBF !== undefined) leaveBalance.leaveBalanceBF = Number(leaveBalanceBF);
      if (currentYearLeave !== undefined) leaveBalance.currentYearLeave = Number(currentYearLeave);
      if (leaveTakenThisYear !== undefined) leaveBalance.leaveTakenThisYear = Number(leaveTakenThisYear);
    }
    await leaveBalance.save();
    res.status(200).json({ message: "Leave balance updated", leaveBalance });
  } catch (error) {
    console.error("Error updating leave balance:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Reset leave balances for all users (admin only)
router.post("/reset", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Admin" && req.user.role !== "HRDirector") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const MAX_CARRY_FORWARD = 15;
    const DEFAULT_ANNUAL_LEAVE = 30;

    const leaveBalances = await LeaveBalance.find();
    for (const balance of leaveBalances) {
      const totalLeaveDays = balance.leaveBalanceBF + balance.currentYearLeave;
      const unusedLeave = totalLeaveDays - balance.leaveTakenThisYear;
      const newCarryForward = Math.min(unusedLeave, MAX_CARRY_FORWARD);

      balance.leaveBalanceBF = newCarryForward;
      balance.currentYearLeave = DEFAULT_ANNUAL_LEAVE;
      balance.leaveTakenThisYear = 0;
      balance.year = new Date().getFullYear();
      await balance.save();
    }

    res.status(200).json({ message: "Leave balances reset successfully" });
  } catch (error) {
    console.error("Error resetting leave balances:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;