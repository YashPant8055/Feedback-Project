const express = require("express");
const path = require("path");
const cors = require("cors");
const errorHandler = require("./middleware/error");

// Route Imports
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const userRoutes = require("./routes/userRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const storyRoutes = require("./routes/storyRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Primary Routes
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);
app.use("/users", userRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/stories", storyRoutes);
app.use("/admin", adminRoutes);

// Health Check
app.get("/health", (req, res) => {
  const mongoose = require("mongoose");
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Base Route
app.get("/", (req, res) => {
  res.json({
    message: "Feedback Project API is running",
    version: "2.0.0 (Modular)",
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
