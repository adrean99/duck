const express = require("express");
const router = express.Router();
const Profile = require("../models/Profile");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");
const { departmentData, allSectors, allDirectorates } = require('../departmentData')

// Get all unique directorates
router.get("/directorates", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const profiles = await Profile.find({}, "directorate").lean();
    const directorates = [...new Set(profiles.map(profile => profile.directorate).filter(Boolean))].sort();
    res.status(200).json(directorates);
  } catch (error) {
    console.error("Error fetching directorates:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get all unique departments
router.get("/departments", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    const profiles = await Profile.find({}, "department").lean();
    const departments = [...new Set(profiles.map(profile => profile.department).filter(Boolean))].sort();
    res.status(200).json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});
// Get all directorates (sub-departments)
router.get("/directorates", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    res.status(200).json(allDirectorates);
  } catch (error) {
    console.error("Error fetching directorates:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// Get department-to-directorates mapping
router.get("/departments-directorates", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), async (req, res) => {
  try {
    res.status(200).json(departmentData);
  } catch (error) {
    console.error("Error fetching departments-directorates mapping:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;