const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
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
    },
    rooms: [
      {
        roomCode: String,
        roomName: String,
        subject: String,
        description: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    pushToken: {
      type: String,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "active"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "teachers",
  }
);

module.exports = mongoose.model("Teacher", teacherSchema);
