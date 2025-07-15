const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = (server, app) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.error('Socket.io authentication error: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Socket.io token decoded:', decoded);
      if (!decoded.id) {
        console.error('Socket.io authentication error: Token lacks user ID');
        return next(new Error('Authentication error: Token lacks user ID'));
      }
      const user = await User.findById(decoded.id).select('name role directorate');
      if (!user) {
        console.error(`Socket.io authentication error: User not found for ID ${decoded.id}`);
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user;
      console.log(`Socket.io authenticated user: ${user.name} (${user._id})`);
      next();
    } catch (err) {
      console.error('Socket.io authentication error:', err.message);
      return next(new Error(`Authentication error: Invalid token - ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on('joinAdmin', (room) => {
      if (socket.user.role === 'Admin') {
        socket.join(room);
        console.log(`Socket ${socket.id} joined admin room: ${room}`);
      } else {
        console.log(`Socket ${socket.id} attempted to join admin room but is not an admin`);
      }
    });

    socket.on('join', (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  app.set('io', io);
  return io;
};