const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Profile = require("../models/Profile");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const router = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin019"; 
const { logAction } = require("../utils/auditLogger");

// USER REGISTRATION
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
     
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 8);

    // Save user
    const newUser = new User({ name, email, password: hashedPassword,  role: "Employee", department: department || "N/A", });
    await newUser.save();
   
    //logAction("Registered user", null, { userId: newUser._id, email, role: "Employee" });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// In routes/authRoutes.js


router.post("/admin/login", async (req, res) => {
  try {
    const { email, password, adminPassword } = req.body;
    if (!email || !password || !adminPassword) {
      return res.status(400).json({ error: "Email, password, and admin password are required" });
    }

    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Invalid admin password" });
    }

    const user = await User.findOne({ email });
    if (!user || user.role !== "Admin") {
      return res.status(401).json({ error: "Only Admins can use this login" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1h" }
    );
     //logAction("Admin logged in", user, { userId: user._id, email });
    res.status(200).json({ token, user: { id: user._id, role: user.role, email: user.email } });
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

// USER LOGIN (JWT Authentication)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
   
    let directorate = user.directorate;
    if (!directorate) {
      const profile = await Profile.findOne({ userId: user._id });
      directorate = profile ? profile.directorate : null;
      if (!directorate) {
        return res.status(400).json({ error: 'User directorate is not defined in profile. Please update your profile.' });
      }
    }
    // Generate JWT Token
    const token = jwt.sign({ id: user._id, role: user.role, directorate: user.directorate, department: user.department }, process.env.JWT_SECRET, { expiresIn: "1h" });
     //logAction("User logged in", user, { userId: user._id, email, role: user.role });
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, directorate: user.directorate, department: user.department } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      'name role directorate department phoneNumber profilePicture chiefOfficerName personNumber email directorName departmentalHeadName HRDirectorName'
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      directorate: user.directorate || 'Unknown',
      department: user.department || 'Unknown',
      phoneNumber: user.phoneNumber || '',
      profilePicture: user.profilePicture || '',
      chiefOfficerName: user.chiefOfficerName || '',
      personNumber: user.personNumber || '',
      email: user.email || '',
      directorName: user.directorName || '',
      departmentalHeadName: user.departmentalHeadName || '',
      HRDirectorName: user.HRDirectorName || '',
    });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});


// PROTECTED ROUTE - ADMIN DASHBOARD
router.get("/admin-dashboard", verifyToken, hasRole(["Director", "DepartmentalHead", "HRDirector", "Admin"]), (req, res) => {
  //logAction("Accessed admin dashboard", req.user, {});
  res.json({ msg: "Welcome to Admin Dashboard!" });
});

// PROTECTED ROUTE - EMPLOYEE DASHBOARD
router.get("/employee-dashboard", verifyToken, (req, res) => {
  //logAction("Accessed employee dashboard", req.user, {});
  res.json({ msg: "Welcome to Employee Dashboard!" });
});



module.exports = router;
