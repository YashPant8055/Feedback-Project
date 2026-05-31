const https = require("https");
const { URL } = require("url");
const dns = require("dns");
const Room = require("../models/Room");

/**
 * Makes an HTTPS GET request resolving the hostname to an IP first.
 * Works around Node.js undici TCP timeout issues on some Windows configurations.
 * Returns parsed JSON body, or throws on failure.
 */
function httpsGetJson(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    dns.resolve4(url.hostname, (err, addresses) => {
      if (err) return reject(new Error(`DNS resolution failed: ${err.message}`));
      const ip = addresses[0];
      const opts = {
        hostname: ip,
        path: url.pathname + url.search,
        servername: url.hostname,
        method: "GET",
        timeout: 15000,
        headers: {
          Accept: "application/json",
          Host: url.hostname,
        },
      };
      const req = https.get(opts, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            reject(new Error(`Failed to parse JSON response (${res.statusCode}): ${body.slice(0, 200)}`));
          }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
      req.end();
    });
  });
}

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
  httpsGetJson,
};
