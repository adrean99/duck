require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require('multer');

const app = express(); // ✅ Define `app` before using it
const server = http.createServer(app); // ✅ Now `app` is available

app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});



// Import models
const Department = require('./models/Department');
const User = require('./models/User'); // Your existing User model
const LeaveRoster = require('./models/LeaveRoster'); // Your existing LeaveRoster model

// Seed Data
const { departmentData, allDirectorates } = require('./departmentData');

const seedData = async () => {
  const departments = Object.keys(departmentData).map(dept => ({
    name: dept,
    directorates: departmentData[dept]
  }));

  await Department.deleteMany({});
  await Department.insertMany(departments);

  // Use existing User model to import employees
  const employees = [
    { name: "James Kimani", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT" },
    { name: "Zack Njenga", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT" },
    { name: "Alvin Mutuma", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT" },
    { name: "Mary Wanja", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT" }
  ];

  await User.deleteMany({});
  const insertedUsers = await User.insertMany(employees);

  // Use existing LeaveRoster model
  const rosters = [
    { 
      employeeId: insertedUsers[0]._id, 
      startDate: new Date("2025-05-23"), 
      endDate: new Date("2025-05-27"), 
      status: "P", 
      directorate: "ICT", 
      department: "Department of Finance, Economic Planning and ICT" 
    }
  ];

  await LeaveRoster.deleteMany({});
  await LeaveRoster.insertMany(rosters);
};


app.get('/api/leaves', (req, res) => {
  res.json({ message: 'Leave requests', data: [] });
});

// Import routes
const leaveRoutes = require("./routes/leaveRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const leaveBalanceRoutes = require("./routes/leaveBalanceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const auditLogsRoutes = require("./routes/auditLogsRoutes");
const leaveRosterRoutes = require("./routes/leaveRosterRoutes");
const optionsRoutes = require("./routes/optionsRoutes");
const metadataRouter = require("./routes/api");

// Use routes
app.use("/api/leave-roster", leaveRosterRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/leaves/admin", adminRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api", optionsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", metadataRouter);

//app.use(verifyToken);

// WebSocket logic
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log("WebSocket connection attempt with token:", token);
  if (!token) {
    console.log("WebSocket authentication failed: No token provided");
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey123");
    console.log("WebSocket authentication successful. Decoded token:", decoded);
    socket.user = decoded;
    console.log("WebSocket authentication successful:", decoded);
    next();
  } catch (error) {
    console.log("WebSocket authentication failed:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  if (!socket.user) {
    console.log("A user connected via WebSocket, but authentication failed.");
    return;
  }
  console.log(`A user connected via WebSocket: ${socket.user.id} (${socket.user.role})`);
   socket.on("subscribe", (data) => {
    if (data.room) {
      socket.join(data.room);
      console.log(`User ${socket.user.id} subscribed to room: ${data.room}`);
    }
  });

  socket.on("joinDirectorate", (directorate) => {
    socket.join(`directorate_${directorate}`);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.user.id} (${socket.user.role})`);
  });
});

// Middleware to attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/leafdev";
// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log(`✅ MongoDB Connected`))
  .catch((err) => console.error(` MongoDB Connection Error: ${err}`));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(` Server running on port ${PORT}`));
