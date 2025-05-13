require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const jwt = require("jsonwebtoken");

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




app.get('/api/leaves', (req, res) => {
  res.json({ message: 'Leave requests', data: [] });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import routes
const leaveRoutes = require("./routes/leaveRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const leaveBalanceRoutes = require("./routes/leaveBalanceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const leaveRosterRoutes = require("./routes/leaveRosterRoutes");

// Use routes
app.use("/api/leave-roster", leaveRosterRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/leaves/admin", adminRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use("/api/users", userRoutes);

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