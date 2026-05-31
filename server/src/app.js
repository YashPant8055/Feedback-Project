require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");
const { configureCloudinary } = require("./config/cloudinary");
const errorHandler = require("./middleware/error");
const { env, validateServerEnv } = require("./config/env");
const { normalizeRoomCode } = require("./utils/helpers");
const Teacher = require("./models/Teacher");
const Room = require("./models/Room");
const Student = require("./models/Student");

// Route Imports
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const userRoutes = require("./routes/userRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const storyRoutes = require("./routes/storyRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Global Middleware
app.use(cors({
  origin: env.corsOrigin === "*" ? "*" : env.corsOrigin.split(",").map(s => s.trim()),
}));
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

const backfillTeacherRoles = async () => {
  try {
    const result = await Teacher.updateMany(
      { role: { $exists: false } },
      { $set: { role: "teacher" } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[SYNC] Backfilled role for ${result.modifiedCount} existing teachers`);
    }
  } catch (err) {
    console.error(`[SYNC] Role backfill error: ${err.message}`);
  }
};

const migrateLegacyRoomCodes = async () => {
  try {
    const rooms = await Room.find({ roomCode: { $regex: /-/ } });
    if (rooms.length > 0) {
      console.log(
        `[SYNC] Found ${rooms.length} rooms with legacy dashed codes. Migrating...`
      );
      for (const room of rooms) {
        const oldCode = room.roomCode;
        const newCode = normalizeRoomCode(oldCode);

        room.roomCode = newCode;
        await room.save();

        await Student.updateMany(
          { "joinedRooms.roomCode": oldCode },
          { $set: { "joinedRooms.$.roomCode": newCode } }
        );

        await Student.updateMany(
          { "feedback.roomCode": oldCode },
          { $set: { "feedback.$[elem].roomCode": newCode } },
          { arrayFilters: [{ "elem.roomCode": oldCode }] }
        );

        console.log(`[SYNC] Migrated ${oldCode} -> ${newCode}`);
      }
    }
  } catch (err) {
    console.error(`[SYNC] Migration error: ${err.message}`);
  }
};

const initialize = async () => {
  validateServerEnv();

  await connectDB();
  configureCloudinary();

  try {
    await Teacher.collection.dropIndex("rooms.roomCode_1");
    console.log("[SYNC] Dropped faulty unique index on rooms.roomCode");
  } catch (_err) {
    // Index may not exist, that's fine
  }

  await migrateLegacyRoomCodes();
  await backfillTeacherRoles();
};

module.exports = { app, env, initialize };
