
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Profile = require('../models/Profile');
const bcrypt = require("bcrypt");
const { logAction } = require("../utils/auditLogger");
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
    const { email, password, name, role, department, directorate, chiefOfficerName, personNumber, directorName, departmentalHeadName, HRDirectorName, profilePicture } = req.body;

    // Validate required fields
    if (!email || !password || !name || !role || !department || !directorate) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name, role, and department are required' });
    }

   /* const validRoles = ["Employee", "Director", "DepartmentalHead", "HRDirector"];
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
    const user = new User({ email, password: hashedPassword, name, role, directorate, department });
    await user.save();
    
    // Create a corresponding profile
    const profile = new Profile({
      userId: user._id,
      name,
      email,
      role,
      department,
      directorate,
      chiefOfficerName,
      personNumber,
      directorName,
      departmentalHeadName,
      HRDirectorName,
      profilePicture,
    });
    await profile.save();
    //logAction("Created user", req.user, { userId: user._id, email, role });
    res.status(201).json({ message: 'User added successfully', userId: user._id });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/*
router.post("/add-user", verifyToken, hasRole(["Admin"]), async (req, res) => {
  try {
    const {email, password, name, role, department, directorate, chiefOfficerName, personNumber, directorName, departmentalHeadName, HRDirectorName } = req.body
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "Email, password, name, and role are required" });
    }

    const validRoles = ["Employee", "Director", "DepartmentalHead", "HRDirector"];
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
      directorate,
      chiefOfficerName,
      personNumber,
      directorName,
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
router.get("/users", hasRole(["Admin", "Director", "DepartmentalHead", "HRDirector"]), async (req, res) => {
  console.log("Authenticated user:", req.user);
  try {
    const users = await User.find({ role: { $ne: "Admin" } }).select("-password");
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const profile = await Profile.findOne({ userId: user._id });
        if (!profile) console.warn(`No profile found for user ${user._id}`);
        return {
          ...user.toObject(),
          directorate: profile ? profile.directorate : null,
        };
      })
    );
    console.log("Enriched users:", enrichedUsers);
    res.status(200).json(enrichedUsers);
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
          directorate: row.directorate,
          chiefOfficerName: row.chiefOfficerName,
          personNumber: row.personNumber,
          directorName: row.directorName,
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
        //logAction("Imported users", req.user, { count: users.length });
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
    //logAction("Changed user password", req.user, { userId });
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
    //logAction("Updated user profile", req.user, { userId, updates });
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
     //logAction("Deleted user", req.user, { userId });
     await Profile.deleteOne({ userId });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/profiles', verifyToken, async (req, res) => {
  try {
    const { userId } = req.query; // Optional query parameter to filter by userId
    let query = {};
    if (userId) {
      query.userId = userId;
    }
    const profiles = await Profile.find(query).lean();
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ error: 'No profiles found' });
    }
    res.status(200).json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get users by directorate and department with admin filtering
router.get("/directorate", verifyToken, async (req, res) => {
  try {
    const { directorate: queryDirectorate, department: queryDepartment } = req.query;
    const user = req.user;

    let query = {};
    let userDirectorate = user.directorate;

    // Determine directorate for non-admins or when no query directorate is provided
    if (!userDirectorate && !["Admin"].includes(user.role)) {
      const profile = await Profile.findOne({ userId: user.id });
      userDirectorate = profile ? profile.directorate : null;
      if (!userDirectorate) {
        return res.status(400).json({ error: 'User directorate is not defined in profile. Please update your profile.' });
      }
    }

    // Build query based on user role and filters
    if (["Admin"].includes(user.role)) {
      // Admins can filter by directorate and department or see all if no filters
      if (queryDirectorate) query.directorate = queryDirectorate;
      if (queryDepartment) query.department = queryDepartment;
    } else {
      // Non-admins are restricted to their own directorate
      query.directorate = userDirectorate || queryDirectorate;
    }

    // Fetch profiles to get userIds based on the query
    const profiles = await Profile.find(query).lean();
    const userIds = profiles.map(profile => profile.userId);

    if (userIds.length === 0) {
      return res.status(404).json({ error: 'No users found with the specified filters' });
    }

    // Fetch users with their details
    const users = await User.find({ _id: { $in: userIds } }, 'name directorate role department').lean();
    const usersWithDetails = users.map(user => ({
      ...user,
      directorate: profiles.find(p => p.userId.toString() === user._id.toString())?.directorate || user.directorate || "",
      department: profiles.find(p => p.userId.toString() === user._id.toString())?.department || user.department || "",
    }));

    res.status(200).json(usersWithDetails);
  } catch (error) {
    console.error('Error fetching users by directorate:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;