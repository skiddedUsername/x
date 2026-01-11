// ================================
// Pow-Forum – Railway Fixed Server
// ================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

// Models
const ForumSettings = require("./models/ForumSettings");

// Routes
const installRoutes = require("./routes/install");
const indexRoutes = require("./routes/index");

const app = express();

/* -------------------------------
   Express Configuration
-------------------------------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "powforum-secret",
    resave: false,
    saveUninitialized: false
  })
);

/* -------------------------------
   MongoDB Connection (Railway)
-------------------------------- */
const mongoUri =
  process.env.MONGO_URL ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

if (!mongoUri) {
  console.error("❌ MongoDB connection string not found");
  process.exit(1);
}

/* -------------------------------
   Async Startup Wrapper (FIX)
-------------------------------- */
async function startServer() {
  // Connect Mongo
  await mongoose.connect(mongo
