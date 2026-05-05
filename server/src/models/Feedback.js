const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "feedback",
  }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
