const express = require("express");
const { verifyToken}  = require("../middleware/authMiddleware"); // Protect routes
const router = express.Router();
const Profile = require("../models/Profile");
const User = require('../models/User');

router.get('/profile/:id', verifyToken, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.status(200).json({ sector: profile.sector });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/profiles', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      name: user.name,
      department: user.department,
      phoneNumber: user.phoneNumber || '',
      profilePicture: user.profilePicture || '',
      chiefOfficerName: user.chiefOfficerName || '',
      supervisorName: user.supervisorName || '',
      personNumber: user.personNumber || '',
      email: user.email,
      sector: user.sector || '',
      sectionalHeadName: user.sectionalHeadName || '',
      departmentalHeadName: user.departmentalHeadName || '',
      HRDirectorName: user.HRDirectorName || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Profile
router.get("/", verifyToken, async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.user.id });
    if (!profile) {
      profile = {
        userId: req.user.id,
        name: "",
        department: "",
        phoneNumber: "",
        profilePicture: "",
        chiefOfficerName: "",
        supervisorName: "",
        personNumber: "",
        email: "",
        sector: "",
        sectionalHeadName:"",
        departmentHeadName:"",
        HRDirectorName:"",
      };
      return res.status(200).json(profile);
    }
    res.status(200).json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.put("/", verifyToken, async (req, res) => {
  try {
    const { name, department, phoneNumber, profilePicture, chiefOfficerName, supervisorName, personNumber, email, sector, sectionalHeadName, departmentalHeadName, HRDirectorName } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (department) updateData.department = department;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profilePicture) updateData.profilePicture = profilePicture;
    if (chiefOfficerName) updateData.chiefOfficerName = chiefOfficerName;
    if (supervisorName) updateData.supervisorName = supervisorName;
    if (personNumber) updateData.personNumber = personNumber;
    if (email) updateData.email = email;
    if (sector) updateData.sector = sector;
    if (sectionalHeadName) updateData.sectionalHeadName = sectionalHeadName;
    if (departmentalHeadName) updateData.departmentalHeadName = departmentalHeadName;
    if (HRDirectorName) updateData.HRDirectorName = HRDirectorName;

    let profile = await Profile.findOne({ userId: req.user.id });
    if (profile) {
      // Update existing profile
      profile = await Profile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } else {
      // Create new profile
      profile = new Profile({
        userId: req.user.id,
        name: name || "",
        department: department || "",
        phoneNumber,
        profilePicture,
        chiefOfficerName,
        supervisorName,
        personNumber,
        email: email || "",
        sector,
        sectionalHeadName,
        departmentalHeadName,
        HRDirectorName,
      });
      await profile.save();
    }

    res.status(200).json({ message: "Profile updated", profile });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;