const mongoose = require("mongoose");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { env } = require("./env");

const connectDB = async () => {
  if (!env.mongoUri) {
    console.error("MONGODB_URI is not set in your .env file.");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(env.mongoUri);
    console.log("MongoDB connected successfully");

    // Ensure collections exist
    await Promise.all([Student.createCollection(), Teacher.createCollection()]);
    console.log("Database collections are ready");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
