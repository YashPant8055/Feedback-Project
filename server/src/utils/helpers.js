const Room = require("../models/Room");

const defaultPreferences = {
  themeSettings: {
    appearanceMode: "system",
    autoRotate: true,
    selectedThemeName: "Aurora",
  },
  storyModePreference: "story1",
};

/**
 * Normalizes a room code by removing dashes/spaces and converting to uppercase.
 */
function normalizeRoomCode(code) {
  if (!code) return "";
  return String(code).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Generates a random alphanumeric code in format XXXXXX
 */
async function generateUniqueRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let isUnique = false;
  let code = "";

  while (!isUnique) {
    let generated = "";
    for (let i = 0; i < 6; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = generated;

    const existing = await Room.findOne({ roomCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

/**
 * Auto-closes a room if its expiry time has passed.
 * (Logic disabled: Rooms now stay active as requested)
 */
async function autoCloseRoomIfExpired(room) {
  // if (room && room.status === "active" && room.expiresAt) {
  //   if (new Date() > new Date(room.expiresAt)) {
  //     room.status = "closed";
  //     await room.save();
  //     
  //     try {
  //       const { emitToRoom } = require("../services/socketService");
  //       emitToRoom(room.roomCode, "room-closed", { roomCode: room.roomCode });
  //     } catch (err) {
  //       console.error("[SOCKET] Failed to emit room-closed from helper:", err.message);
  //     }
  //     
  //     console.log(`[ROOM] Auto-closed room ${room.roomCode} (expired at ${room.expiresAt})`);
  //   }
  // }
  return room;
}

function buildStudentResponse(student) {
  return {
    id: student._id,
    name: student.name,
    email: student.email,
    role: "student",
    joinedRooms: student.joinedRooms || [],
    preferences: {
      themeSettings: {
        ...defaultPreferences.themeSettings,
        ...(student.preferences?.themeSettings?.toObject?.() ||
          student.preferences?.themeSettings ||
          {}),
      },
      storyModePreference:
        student.preferences?.storyModePreference ||
        defaultPreferences.storyModePreference,
    },
    pushToken: student.pushToken || "",
    profileImage: student.profileImage || "",
  };
}

function buildTeacherResponse(teacher) {
  return {
    id: teacher._id,
    name: teacher.name,
    email: teacher.email,
    role: teacher.role || "teacher",
    rooms: teacher.rooms || [],
    preferences: {
      themeSettings: {
        ...defaultPreferences.themeSettings,
        ...(teacher.preferences?.themeSettings?.toObject?.() ||
          teacher.preferences?.themeSettings ||
          {}),
      },
    },
    pushToken: teacher.pushToken || "",
    profileImage: teacher.profileImage || "",
  };
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = {
  defaultPreferences,
  normalizeRoomCode,
  generateUniqueRoomCode,
  autoCloseRoomIfExpired,
  buildStudentResponse,
  buildTeacherResponse,
  formatDate,
};
