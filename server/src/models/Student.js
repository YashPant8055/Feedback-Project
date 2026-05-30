const mongoose = require("mongoose");

const feedbackEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["emoji", "selfie", "written", "story"],
      trim: true,
      default: "written",
    },
    storyId: {
      type: String,
      trim: true,
      default: "",
    },
    emoji: {
      type: String,
      trim: true,
      default: "",
    },
    emotion: {
      type: String,
      trim: true,
      default: "",
    },
    review: {
      type: String,
      enum: ["good", "average", "bad", ""],
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    roomCode: {
      type: String,
      trim: true,
      default: "",
    },
    roomName: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const studentSchema = new mongoose.Schema(
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
    feedback: [feedbackEntrySchema],
    joinedRooms: [
      {
        roomCode: {
          type: String,
          trim: true,
          uppercase: true,
        },
        roomName: {
          type: String,
          trim: true,
        },
        joinedAt: {
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
    emailVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      codeHash: {
        type: String,
        default: "",
      },
      purpose: {
        type: String,
        enum: ["email-verification", "password-reset", "login", ""],
        default: "",
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    collection: "students",
  }
);

module.exports = mongoose.model("Student", studentSchema);
