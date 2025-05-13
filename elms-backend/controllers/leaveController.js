const Leave = require("../models/Leave");

// Get leave requests for logged-in user
const getLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ user: req.user.id }); // Fetch only for logged-in user
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};

// Apply for leave
const applyLeave = async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  if (!leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({ msg: "Please fill all fields" });
  }

  try {
    const newLeave = new Leave({
      user: req.user.id,
      leaveType,
      startDate,
      endDate,
      reason,
      status: "Pending",
    });

    await newLeave.save();
    res.json(newLeave);
  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};

module.exports = { getLeaves, applyLeave };
