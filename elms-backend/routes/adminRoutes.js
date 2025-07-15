const express = require("express");
const router = express.Router();
const { verifyToken, hasRole } = require("../middleware/authMiddleware"); // Added hasRole
const User = require("../models/User");
const ShortLeave = require("../models/ShortLeave");
const AnnualLeave = require("../models/AnnualLeave");
const multer = require("multer");
const path = require("path");
const { logAction } = require("../utils/auditLogger");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only images (jpeg, jpg, png) are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Get admin profile
router.get("/profile", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Update admin profile with file upload
router.put("/profile", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), upload.single("profilePicture"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {
      name: req.body.name,
      email: req.body.email,
      department: req.body.department,
      phoneNumber: req.body.phoneNumber,
      chiefOfficerName: req.body.chiefOfficerName,
      personNumber: req.body.personNumber,
      directorate: req.body.directorate,
      directorName: req.body.directorName,
      departmentalHeadName: req.body.departmentalHeadName,
      HRDirectorName: req.body.HRDirectorName,
    };

    if (req.file) {
      updates.profilePicture = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
     logAction("Updated admin profile", req.user, { userId: req.user.id, updates });
    res.status(200).json({ profile: updatedUser });
  } catch (error) {
    console.error("Error updating admin profile:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get leaves for admin dashboard
router.get("/leaves", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const { leaveType } = req.query;
    if (!leaveType) {
      return res.status(400).json({ error: "Leave type is required" });
    }

    let leaves;
    if (leaveType === "Short Leave") {
      leaves = await ShortLeave.find();
    } else if (leaveType === "Annual Leave") {
      leaves = await AnnualLeave.find();
    } else {
      return res.status(400).json({ error: "Invalid leave type" });
    }

    res.status(200).json(leaves);
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Update leave status
router.patch("/leaves/:id", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const leaveId = req.params.id;
    const updates = req.body;

    // Try to find the leave in ShortLeave collection
    let leave = await ShortLeave.findById(leaveId);
    let isShortLeave = !!leave;
    if (!leave) {
      // If not found in ShortLeave, try AnnualLeave
      leave = await AnnualLeave.findById(leaveId);
    }
    if (!leave) {
      return res.status(404).json({ error: "Leave not found" });
    }

    // Role-based update restrictions
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
      HRDirector: ["HRDirectorRecommendation", "HRDirectorDate"],
      Admin: [
        "directorRecommendation",
        "directorDate",
        "departmentalHeadRecommendation",
        "departmentalHeadDate",
        "departmentalHeadDaysGranted",
        "departmentalHeadStartDate",
        "departmentalHeadLastDate",
        "departmentalHeadResumeDate",
        "HRDirectorRecommendation",
        "HRDirectorDate",
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

    // Prevent duplicate Director actions
    if (userRole === "Director" && (leave.directorRecommendation || leave.directorDate)) {
      return res.status(400).json({ error: "Director has already approved or rejected this leave" });
    }

    // Update status based on HRDirector or Admin approval
    if ((userRole === "HRDirector" || userRole === "Admin") && "HRDirectorRecommendation" in filteredUpdates) {
      filteredUpdates.status = filteredUpdates.approverRecommendation === "Approved" ? "Approved" : "Rejected";
    }

    // Apply updates
    Object.assign(leave, filteredUpdates);
    await leave.save();

    // logAction("Updated leave status", req.user, { leaveId, updates: filteredUpdates });
    res.status(200).json(leave);
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get all leaves for calendar
router.get("/all", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    // Fetch leaves from both collections
    const shortLeaves = await ShortLeave.find();
    const annualLeaves = await AnnualLeave.find();

    // Combine the results
    const allLeaves = [...shortLeaves, ...annualLeaves];
    res.status(200).json(allLeaves);
  } catch (error) {
    console.error("Error fetching all leaves:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;