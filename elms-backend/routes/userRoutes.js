
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Profile = require('../models/Profile');
const bcrypt = require("bcrypt");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");
const csvParser = require('csv-parser');
const { Readable } = require('stream');

/* const restrictToRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user ||  !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
};
*/

router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}); 


router.post('/add-user', async (req, res) => {
  try {
    const { email, password, name, role, department, sector, chiefOfficerName, supervisorName, personNumber, sectionalHeadName, departmentalHeadName, HRDirectorName, profilePicture } = req.body;

    // Validate required fields
    if (!email || !password || !name || !role || !department) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name, role, and department are required' });
    }

   /* const validRoles = ["Employee", "Supervisor", "SectionalHead", "DepartmentalHead", "HRDirector"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
   */
    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({ email, password: hashedPassword, name, role, department });
    await user.save();

    // Create a corresponding profile
    const profile = new Profile({
      userId: user._id,
      name,
      email,
      role,
      department,
      sector,
      chiefOfficerName,
      supervisorName,
      personNumber,
      sectionalHeadName,
      departmentalHeadName,
      HRDirectorName,
      profilePicture,
    });
    await profile.save();

    res.status(201).json({ message: 'User added successfully', userId: user._id });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/*
router.post("/add-user", verifyToken, hasRole(["Admin"]), async (req, res) => {
  try {
    const {email, password, name, role, department, sector, chiefOfficerName, supervisorName, personNumber, sectionalHeadName, departmentalHeadName, HRDirectorName } = req.body
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "Email, password, name, and role are required" });
    }

    const validRoles = ["Employee", "Supervisor", "SectionalHead", "DepartmentalHead", "HRDirector"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }
     const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      password: hashedPassword,
      name,
      role,
      department,
      sector,
      chiefOfficerName,
      supervisorName,
      personNumber,
      sectionalHeadName,
      departmentalHeadName,
      HRDirectorName
    });

    await user.save();
    res.status(201).json({ message: "User added successfully", user });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});
*/
router.get("/users", hasRole(["Admin", "Supervisor", "SectionalHead", "DepartmentalHead", "HRDirector"]), async (req, res) => {
  console.log("Authenticated user:", req.user);
  try {
    const users = await User.find({ role: { $ne: "Admin" } }); // Exclude Admins
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.post('/import-users', async (req, res) => {
  try {
    const users = [];
    const fileBuffer = req.files.file.data;
    const readableStream = Readable.from(fileBuffer);

    readableStream
      .pipe(csvParser())
      .on('data', (row) => {
        users.push({
          email: row.email,
          password: row.password,
          name: row.name,
          role: row.role || 'Employee',
          department: row.department,
          sector: row.sector,
          chiefOfficerName: row.chiefOfficerName,
          supervisorName: row.supervisorName,
          personNumber: row.personNumber,
          sectionalHeadName: row.sectionalHeadName,
          departmentalHeadName: row.departmentalHeadName,
          HRDirectorName: row.HRDirectorName,
          profilePicture: row.profilePicture
        });
      })
      .on('end', async () => {
        for (const user of users) {
          const existingUser = await User.findOne({ email: user.email });
          if (!existingUser) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
            await User.create(user);
          }
        }
        res.status(201).json({ message: 'Users imported successfully' });
      });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/change-password/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    Object.assign(user, updates);
    await user.save();

    const profile = await Profile.findOne({ userId });
    if (profile) {
      Object.assign(profile, updates);
      await profile.save();
    } else {
      const newProfile = new Profile({ userId, ...updates });
      await newProfile.save();
    }
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
     await Profile.deleteOne({ userId });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/sector', verifyToken, async (req, res) => {
  try {
    let userSector = req.user.sector;
    if (!userSector) {
      const profile = await Profile.findOne({ userId: req.user.id });
      userSector = profile ? profile.sector : null;
      if (!userSector) {
        return res.status(400).json({ error: 'User sector is not defined in profile. Please update your profile.' });
      }
    }

    const users = await User.find({ sector: userSector }, 'name sector role');
    if (!users || users.length === 0) {
      // Fallback to fetch sector from Profile for all users
      const profiles = await Profile.find({ sector: userSector }, 'userId sector');
      const userIds = profiles.map(p => p.userId);
      const usersWithProfileSector = await User.find({ _id: { $in: userIds } }, 'name sector role');
      if (!usersWithProfileSector || usersWithProfileSector.length === 0) {
        return res.status(404).json({ error: 'No users found in this sector' });
      }
      return res.status(200).json(usersWithProfileSector);
    }

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users by sector:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;