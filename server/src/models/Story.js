const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    landscape: {
      main: { type: String, required: true },
      good: { type: String, required: true },
      average: { type: String, required: true },
      bad: { type: String, required: true },
    },
    mobile: {
      main: { type: String, required: true },
      good: { type: String, required: true },
      average: { type: String, required: true },
      bad: { type: String, required: true },
    },
    cloudinaryIds: [String],
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    teacherName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "stories",
  }
);

module.exports = mongoose.model("Story", storySchema);
