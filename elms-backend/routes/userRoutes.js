
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const { verifyToken, hasRole } = require("../middleware/authMiddleware");

router.post("/add-user", verifyToken, hasRole(["Admin"]), async (req, res) => {
  try {
    const { email, password, name, role, department } = req.body;
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      name,
      role,
      department,
    });

    await user.save();
    res.status(201).json({ message: "User added successfully", user });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.get("/users", verifyToken, hasRole(["Admin"]), async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "Admin" } }); // Exclude Admins
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;