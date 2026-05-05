const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
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
      enum: ["student", "teacher", "admin"],
      default: "student",
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

module.exports = mongoose.model("User", userSchema);
