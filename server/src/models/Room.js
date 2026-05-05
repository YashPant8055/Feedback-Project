const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    roomName: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    question: {
      type: String,
      trim: true,
      default: "How was the session?",
    },
    storyQuestions: [
      {
        text: { type: String, required: true },
        options: [
          {
            label: { type: String, required: true },
            score: { type: Number, required: true },
          }
        ]
      }
    ],
    enabledFeedbackModes: {
      type: [String],
      enum: ["emoji", "selfie", "written", "story"],
      default: ["emoji", "selfie", "written", "story"],
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    teacherName: {
      type: String,
      trim: true,
      default: "",
    },
    teacherEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
    durationMinutes: {
      type: Number,
      default: 0, // 0 means no time limit
    },
    expiresAt: {
      type: Date,
    },
    feedbackLimitPerStudent: {
      type: Number,
      default: 0, // 0 means no limit
    },
    maxStudents: {
      type: Number,
      default: 0, // 0 means no limit
    },
    studentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    feedback: [
      {
        studentId: mongoose.Schema.Types.ObjectId,
        studentName: String,
        type: { type: String, required: true },
        review: String,
        message: String,
        emoji: String,
        emotion: String,
        storyId: String,
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: "rooms",
  }
);

module.exports = mongoose.model("Room", roomSchema);
