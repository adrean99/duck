require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const path = require("path");
//const setupSocket = require("./socket"); // Import Socket.io setup
const Department = require("./models/Department");
const User = require("./models/User");
const LeaveRoster = require("./models/LeaveRoster");
const { departmentData } = require("./departmentData");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const multer = require('multer');

const app = express(); // ✅ Define `app` before using it
const server = http.createServer(app); // ✅ Now `app` is available


app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "Uploads")));


const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

//const io = setupSocket(server, app);

/// Seed Data
const seedData = async () => {
  try {
    // Seed Departments
    const departments = Object.keys(departmentData).map(dept => ({
      name: dept,
      directorates: departmentData[dept],
    }));
    await Department.deleteMany({});
    await Department.insertMany(departments);
    console.log("Departments seeded successfully");

    // Seed Users
    const employees = [
      { name: "James Kimani", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT", role: "Employee" },
      { name: "Zack Njenga", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT", role: "Employee" },
      { name: "Alvin Mutuma", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT", role: "Employee" },
      { name: "Mary Wanja", directorate: "ICT", department: "Department of Finance, Economic Planning and ICT", role: "Admin" },
    ];
    await User.deleteMany({});
    const insertedUsers = await User.insertMany(employees);
    console.log("Users seeded successfully");

    // Seed LeaveRosters
    const rosters = [
      {
        employeeId: insertedUsers[0]._id,
        directorate: "ICT",
        department: "Department of Finance, Economic Planning and ICT",
        periods: [
          {
            startDate: new Date("2025-05-23"),
            endDate: new Date("2025-05-27"),
            leaveType: "Annual Leave",
            status: "Suggested",
            suggestedBy: "Employee",
          },
        ],
      },
    ];
    await LeaveRoster.deleteMany({});
    await LeaveRoster.insertMany(rosters);
    console.log("Leave rosters seeded successfully");
  } catch (err) {
    console.error("Error seeding data:", err);
  }
};


//app.get('/api/leaves', (req, res) => {
 // res.json({ message: 'Leave requests', data: [] });
//});

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
const metadataRoutes = require("./routes/metadataRoutes");

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
app.use("/api/metadata", metadataRoutes);

//app.use(verifyToken);

// WebSocket logic
/*
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
*/
// Middleware to attach io to req

io.on('connection', (socket) => {
  console.log('Socket.io connected:', socket.id);

  socket.use(async (packet, next) => {
    const token = socket.handshake.auth.token?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require('./models/User');
      const user = await User.findById(decoded.id).select('id role directorate department');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user;
      console.log('Socket.io authenticated user:', socket.user);
      next();
    } catch (err) {
      console.error('Socket.io authentication error:', err);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  socket.on('join', (room) => {
    if (['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(socket.user.role)) {
      socket.join('admin-room');
      console.log(`Socket ${socket.id} joined room: admin-room`);
    } else if (socket.user.directorate && socket.user.directorate !== 'Unknown') {
      socket.join(`directorate:${socket.user.directorate}`);
      console.log(`Socket ${socket.id} joined room: directorate:${socket.user.directorate}`);
    }
  });

  socket.on('joinAdmin', () => {
    if (['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(socket.user.role)) {
      socket.join('admin-room');
      console.log(`Socket ${socket.id} joined room: admin-room`);
    }
  });

  socket.on('leaveSuggested', (data) => {
    if (['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(socket.user.role)) {
      io.to('admin-room').emit('leaveSuggested', data);
    }
    io.to(`directorate:${data.directorate}`).emit('leaveSuggested', data);
  });

  socket.on('error', (err) => {
    console.error('Socket.io error:', err.message);
  });

  socket.on('disconnect', () => {
    console.log('Socket.io disconnected:', socket.id);
  });
});

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
