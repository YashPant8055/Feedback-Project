const Room = require("../models/Room");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { normalizeRoomCode } = require("../utils/helpers");
const { emitToRoom } = require("../services/socketService");
const { notifyTeacherOfNewFeedback } = require("../services/notificationService");

exports.submitFeedback = async (req, res) => {
  try {
    const { type, storyId, emoji, emotion, review, message, metadata, roomCode, roomName } = req.body;
    const user = req.user;
    const isTeacher = req.role === "teacher";

    if (!type) return res.status(400).json({ message: "type is required" });

    const normalizedCode = normalizeRoomCode(roomCode);
    if (!normalizedCode) {
      return res.status(400).json({ 
        message: "Active session required. Please join a room before submitting feedback." 
      });
    }

    const room = await Room.findOne({ roomCode: normalizedCode });
    if (!room) return res.status(404).json({ message: "This room no longer exists." });

    if (room.status === "closed" || (room.expiresAt && new Date() > room.expiresAt)) {
      return res.status(403).json({ message: "This room is currently closed." });
    }

    // Check feedback limit per student
    if (room.feedbackLimitPerStudent > 0 && !isTeacher) {
      const count = (room.feedback || []).filter(f => f.studentId && f.studentId.toString() === user._id.toString()).length;
      if (count >= room.feedbackLimitPerStudent) {
        return res.status(403).json({ 
          message: "You have already reached the submission limit for this room.",
          alreadySubmitted: true 
        });
      }
    }

    let finalReview = review;
    if (!finalReview && emoji) {
      const reviewMap = { 'happy': 'good', 'neutral': 'average', 'sad': 'bad', 'surprised': 'average', 'great': 'good', 'okay': 'average', 'low': 'bad' };
      finalReview = reviewMap[emoji.toLowerCase()] || "";
    }

    const newEntry = {
      type,
      storyId: storyId || "",
      emoji: emoji || "",
      emotion: emotion || "",
      review: finalReview,
      message: message || "",
      roomCode: normalizedCode,
      roomName: roomName || room.roomName || "",
      metadata: metadata || {},
    };

    const studentDisplayName = user.name || user.email.split("@")[0] || "User";
    const mirrorEntry = {
      ...newEntry,
      studentId: user._id,
      studentName: studentDisplayName,
      createdAt: new Date(),
    };

    if (!isTeacher) {
      user.feedback = user.feedback || [];
      user.feedback.push(newEntry);
      await user.save();
    }

    const roomUpdate = await Room.findOneAndUpdate(
      { roomCode: normalizedCode },
      { $push: { feedback: mirrorEntry } },
      { new: true }
    );

    if (roomUpdate) {
      // Real-time update via Socket.io
      emitToRoom(normalizedCode, "new-feedback", mirrorEntry);
      
      // Push notification to teacher
      notifyTeacherOfNewFeedback(room.teacherId, room.roomName, room.roomCode);

      return res.status(201).json({
        message: "Thanks for your feedback!",
        feedback: isTeacher ? mirrorEntry : user.feedback[user.feedback.length - 1],
      });
    } else {
      return res.status(500).json({ message: "Failed to sync feedback with room records." });
    }
  } catch (error) {
    console.error(`[FEEDBACK] Error: ${error.message}`);
    return res.status(500).json({ message: "Failed to save feedback", error: error.message });
  }
};

exports.getFeedbackHistory = async (req, res) => {
  try {
    const user = req.user;
    if (req.role !== "student") return res.json([]);

    const sorted = [...user.feedback].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(sorted);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch feedback", error: error.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const user = req.user;

    const feedbackToDelete = user.feedback.id(feedbackId);
    if (!feedbackToDelete) return res.status(404).json({ message: "Feedback entry not found" });

    if (feedbackToDelete.roomCode) {
      const normalizedCode = normalizeRoomCode(feedbackToDelete.roomCode);
      await Room.updateOne(
        { roomCode: normalizedCode },
        { $pull: { feedback: { _id: feedbackToDelete._id } } }
      );
    }

    user.feedback.pull(feedbackId);
    await user.save();

    return res.json({ message: "Feedback deleted successfully", feedback: user.feedback });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete feedback", error: error.message });
  }
};
