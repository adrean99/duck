const express = require("express");
const { verifyToken}  = require("../middleware/authMiddleware"); 
const router = express.Router();
const Profile = require("../models/Profile");
const User = require('../models/User');

router.get('/api/profile/:id', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name directorate department role');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const profile = await Profile.findOne({ userId: req.params.id }).select('directorate department');
    res.json({
      ...user.toObject(),
      directorate: profile?.directorate || user.directorate,
      department: profile?.department || user.department,
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to fetch user profile', details: err.message });
  }
});

/*
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
*/

router.get('/profiles', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      name: user.name,
      department: user.department,
      phoneNumber: user.phoneNumber || '',
      profilePicture: user.profilePicture || '',
      chiefOfficerName: user.chiefOfficerName || '',
      personNumber: user.personNumber || '',
      email: user.email,
      directorate: user.directorate || '',
      directorName: user.directorName || '',
      departmentalHeadName: user.departmentalHeadName || '',
      HRDirectorName: user.HRDirectorName || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { directorate, department, role } = req.query;
    const query = {};

    // Non-privileged users can only see profiles in their directorate
    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role)) {
      if (!req.user.directorate || req.user.directorate === 'Unknown') {
        return res.status(400).json({ error: 'Valid directorate is required' });
      }
      query.directorate = req.user.directorate;
    }

    // Optional filters
    if (directorate && directorate !== 'Unknown') {
      if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role) && directorate !== req.user.directorate) {
        return res.status(403).json({ error: 'Unauthorized to view this directorate' });
      }
      query.directorate = directorate;
    }
    if (department && department !== 'undefined') {
      query.department = department;
    }
    if (role) {
      query.role = role;
    }

    const profiles = await Profile.find(query)
      .select('userId name role directorate department email')
      .lean();
    
    if (!profiles.length) {
      return res.status(404).json({ error: 'No profiles found' });
    }

    res.json(profiles);
  } catch (err) {
    console.error('Error fetching profiles:', err);
    res.status(500).json({ error: 'Failed to fetch profiles', details: err.message });
  }
});

router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    let profile = await Profile.findOne({ userId })
      .select('userId name role directorate department email phoneNumber profilePicture chiefOfficerName personNumber directorName departmentalHeadName HRDirectorName')
      .lean();
    
    if (!profile) {
      // Fallback to User model if Profile doesn't exist
      const user = await User.findById(userId).select('name role directorate department phoneNumber profilePicture chiefOfficerName personNumber email directorName departmentalHeadName HRDirectorName');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      profile = {
        userId: user._id,
        name: user.name || '',
        role: user.role || 'Employee',
        directorate: user.directorate || '',
        department: user.department || '',
        phoneNumber: user.phoneNumber || '',
        profilePicture: user.profilePicture || '',
        chiefOfficerName: user.chiefOfficerName || '',
        personNumber: user.personNumber || '',
        email: user.email || '',
        directorName: user.directorName || '',
        departmentalHeadName: user.departmentalHeadName || '',
        HRDirectorName: user.HRDirectorName || '',
      };
    }

    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role) && profile.directorate !== req.user.directorate) {
      return res.status(403).json({ error: 'Unauthorized to view this profile' });
    }

    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

router.put('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.user.id && !['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized: Can only update own profile or privileged access required' });
    }

    const {
      name, department, phoneNumber, profilePicture, chiefOfficerName,
      personNumber, email, directorate, directorName, departmentalHeadName, HRDirectorName
    } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (department) updateData.department = department;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profilePicture) updateData.profilePicture = profilePicture;
    if (chiefOfficerName) updateData.chiefOfficerName = chiefOfficerName;
    if (personNumber) updateData.personNumber = personNumber;
    if (email) updateData.email = email;
    if (directorate) updateData.directorate = directorate;
    if (directorName) updateData.directorName = directorName;
    if (departmentalHeadName) updateData.departmentalHeadName = departmentalHeadName;
    if (HRDirectorName) updateData.HRDirectorName = HRDirectorName;

    let profile = await Profile.findOne({ userId });
    if (profile) {
      profile = await Profile.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } else {
      profile = new Profile({
        userId,
        name: name || '',
        role: req.user.role || 'Employee',
        department: department || '',
        phoneNumber: phoneNumber || '',
        profilePicture: profilePicture || '',
        chiefOfficerName: chiefOfficerName || '',
        personNumber: personNumber || '',
        email: email || '',
        directorate: directorate || '',
        directorName: directorName || '',
        departmentalHeadName: departmentalHeadName || '',
        HRDirectorName: HRDirectorName || '',
      });
      await profile.save();
    }

    // Update User model to keep data in sync
    await User.findByIdAndUpdate(userId, {
      $set: {
        name: updateData.name || profile.name,
        directorate: updateData.directorate || profile.directorate,
        department: updateData.department || profile.department,
        phoneNumber: updateData.phoneNumber || profile.phoneNumber,
        profilePicture: updateData.profilePicture || profile.profilePicture,
        chiefOfficerName: updateData.chiefOfficerName || profile.chiefOfficerName,
        personNumber: updateData.personNumber || profile.personNumber,
        email: updateData.email || profile.email,
        directorName: updateData.directorName || profile.directorName,
        departmentalHeadName: updateData.departmentalHeadName || profile.departmentalHeadName,
        HRDirectorName: updateData.HRDirectorName || profile.HRDirectorName,
      }
    });

    res.status(200).json({ message: 'Profile updated', profile });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});
/*
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
        personNumber: "",
        email: "",
        directorate: "",
        directorName:"",
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
    const { name, department, phoneNumber, profilePicture, chiefOfficerName, personNumber, email, directorate, directorName, departmentalHeadName, HRDirectorName } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (department) updateData.department = department;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profilePicture) updateData.profilePicture = profilePicture;
    if (chiefOfficerName) updateData.chiefOfficerName = chiefOfficerName;
    if (personNumber) updateData.personNumber = personNumber;
    if (email) updateData.email = email;
    if (directorate) updateData.directorate = directorate;
    if (directorName) updateData.directorName = directorName;
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
        personNumber,
        email: email || "",
        directorate,
        directorName,
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
*/
module.exports = router;