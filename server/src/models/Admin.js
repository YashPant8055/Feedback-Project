const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    preferences: {
      themeSettings: {
        appearanceMode: {
          type: String,
          enum: ["system", "dark", "light"],
          default: "system",
        },
        autoRotate: {
          type: Boolean,
          default: true,
        },
        selectedThemeName: {
          type: String,
          default: "Aurora",
        },
      },
      storyModePreference: {
        type: String,
        enum: ["story1", "story2", "random"],
        default: "story1",
      },
    },
    role: {
      type: String,
      default: "admin", // Hardcoded to admin for this model
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
    collection: "admins", // Explicitly named 'admins'
  }
);

module.exports = mongoose.model("Admin", adminSchema);
