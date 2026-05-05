const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { buildStudentResponse, buildTeacherResponse, defaultPreferences, normalizeRoomCode } = require("../utils/helpers");

exports.getProfile = async (req, res) => {
  if (req.role === "student") {
    return res.json(buildStudentResponse(req.user));
  }
  return res.json(buildTeacherResponse(req.user));
};

exports.updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const user = req.user;
    const role = req.role;

    const nextThemeSettings = {
      ...defaultPreferences.themeSettings,
      ...(user.preferences?.themeSettings?.toObject?.() || user.preferences?.themeSettings || {}),
      ...(preferences?.themeSettings || {}),
    };

    if (role === "student") {
      user.preferences = {
        themeSettings: nextThemeSettings,
        storyModePreference: preferences?.storyModePreference || user.preferences?.storyModePreference || defaultPreferences.storyModePreference,
      };
    } else {
      user.preferences = { themeSettings: nextThemeSettings };
    }

    await user.save();
    return res.json({
      message: "Preferences saved successfully",
      user: role === "student" ? buildStudentResponse(user) : buildTeacherResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save preferences", error: error.message });
  }
};

exports.updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (pushToken === undefined) return res.status(400).json({ message: "pushToken is required" });

    req.user.pushToken = pushToken;
    await req.user.save();

    return res.json({ message: "Push token updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update push token", error: error.message });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.body;
    const student = req.user;

    if (req.role !== "student") return res.status(403).json({ message: "Only students can join rooms" });

    const normalizedCode = normalizeRoomCode(roomCode);
    const Room = require("../models/Room");
    const room = await Room.findOne({ roomCode: normalizedCode });

    if (!room) return res.status(404).json({ message: "Invalid room code" });
    if (room.status === "closed") return res.status(403).json({ message: "This room is currently closed" });

    // Check student capacity
    if (room.maxStudents > 0 && room.studentIds.length >= room.maxStudents) {
      const isAlreadyMember = room.studentIds.some(id => id.toString() === student._id.toString());
      if (!isAlreadyMember) {
        return res.status(403).json({ message: "This room has reached its maximum student capacity" });
      }
    }

    await Room.updateOne({ roomCode: normalizedCode }, { $addToSet: { studentIds: student._id } });

    const alreadyJoined = student.joinedRooms.some((r) => r.roomCode === room.roomCode);
    if (!alreadyJoined) {
      student.joinedRooms.push({ roomCode: room.roomCode, roomName: room.roomName, joinedAt: new Date() });
      await student.save();
    }

    return res.json({ message: "Joined room successfully", room });
  } catch (error) {
    return res.status(500).json({ message: "Failed to join room", error: error.message });
  }
};

exports.removeStudentHistory = async (req, res) => {
    try {
      const { roomCode } = req.params;
      const normalizedCode = normalizeRoomCode(roomCode);
      const student = await Student.findByIdAndUpdate(
        req.user._id,
        { $pull: { joinedRooms: { roomCode: { $in: [normalizedCode, roomCode] } } } },
        { new: true }
      );
      return res.json({ message: "Room removed from history", joinedRooms: student.joinedRooms });
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove room from history", error: error.message });
    }
};

exports.removeTeacherHistory = async (req, res) => {
    try {
      const { roomCode } = req.params;
      const normalizedCode = normalizeRoomCode(roomCode);
      const teacher = await Teacher.findByIdAndUpdate(
        req.user._id,
        { $pull: { rooms: { roomCode: { $in: [normalizedCode, roomCode] } } } },
        { new: true }
      );
      return res.json({ message: "Room removed from history", rooms: teacher.rooms });
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove room from history", error: error.message });
    }
};

exports.updateProfileImage = async (req, res) => {
  try {
    const { image } = req.body; // Base64 string or empty string to remove
    const { cloudinary } = require("../config/cloudinary");
    
    let updatedUser;
    const publicId = `profile_${req.user._id}`;

    if (!image || image === "" || image === null) {
      console.log(`[USER] Removing profile image for user: ${req.user._id}`);
      // Also delete from Cloudinary to save space
      try {
        await cloudinary.uploader.destroy(`profile_images/${publicId}`);
      } catch (e) {
        console.error("[CLOUDINARY] Destroy error:", e.message);
      }
      
      const Model = req.role === "student" ? require("../models/Student") : require("../models/Teacher");
      updatedUser = await Model.findByIdAndUpdate(
        req.user._id,
        { $set: { profileImage: "" } },
        { new: true }
      );
    } else {
      const uploadRes = await cloudinary.uploader.upload(image, {
        public_id: publicId,
        folder: "profile_images",
        overwrite: true,
        invalidate: true, // Invalidate CDN cache
        transformation: [{ width: 500, height: 500, crop: "limit" }]
      });

      const Model = req.role === "student" ? require("../models/Student") : require("../models/Teacher");
      updatedUser = await Model.findByIdAndUpdate(
        req.user._id,
        { $set: { profileImage: uploadRes.secure_url } },
        { new: true }
      );
    }

    return res.json({
      message: !image ? "Profile image removed" : "Profile image updated",
      profileImage: updatedUser.profileImage,
      user: req.role === "student" ? buildStudentResponse(updatedUser) : buildTeacherResponse(updatedUser)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to upload image", error: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  // Placeholder for password change
  return res.json({
    message: "Password management is currently in maintenance. Please contact support to reset your password.",
    success: true
  });
};
