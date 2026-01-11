// -------------------------------
// Pow-Forum Railway Patched Server
// -------------------------------

// Local development support for dotenv
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
    console.log("🔧 Loaded local .env");
  } catch (_) {}
}

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const updateEnv = require('./my_modules/updateenv'); // now a no-op
const app = express();

// Static + view engine config
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Socket.io setup
const server = http.createServer(app);
const io = socketio(server);

// Attach io globally (Pow-Forum uses this pattern)
global.io = io;

// Session configuration (same as Pow-Forum)
app.use(
  session({
    secret: process.env.JWT_SECRET || "changeme_dev",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 },
  })
);

// ----------------------
// MongoDB Connection
// ----------------------

const mongoURI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI || // Railway plugin default
  "mongodb://localhost:27017/powforum";

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB database connected");
    // updateEnv() removed because Railway doesn't allow .env writes
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ----------------------
// Pow-Forum Routes
// ----------------------

// IMPORTANT: Keep this pointing to existing Pow-Forum routes
require('./routes')(app);

// ----------------------
// Socket.io Events
// ----------------------
io.on('connection', (socket) => {
  console.log("🌐 User connected:", socket.id);

  socket.on('disconnect', () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// ----------------------
// Railway Port Handling
// ----------------------
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Powrum server started on port ${PORT}`);
});
