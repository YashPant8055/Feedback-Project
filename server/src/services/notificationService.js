const { Expo } = require("expo-server-sdk");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

const expo = new Expo();

/**
 * Sends push notifications to a list of tokens.
 */
const sendPushNotifications = async (tokens, title, body, data = {}) => {
  const messages = [];
  for (const pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`[PUSH] Invalid token: ${pushToken}`);
      continue;
    }
    messages.push({
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(`[PUSH] Error sending chunk: ${error.message}`);
    }
  }

  return tickets;
};

/**
 * Alerts all registered students about a new room.
 */
const notifyAllStudentsOfNewRoom = async (roomName, roomCode, teacherName) => {
  try {
    const students = await Student.find({ pushToken: { $exists: true, $ne: "" } }, "pushToken");
    const tokens = students.map((s) => s.pushToken);
    
    if (tokens.length === 0) return;

    await sendPushNotifications(
      tokens,
      "New Room Available!",
      `${teacherName} created a new room: ${roomName} (${roomCode})`,
      { screen: "JoinRoom", roomCode }
    );
    console.log(`[PUSH] Sent room notification to ${tokens.length} students.`);
  } catch (error) {
    console.error(`[PUSH] notifyAllStudentsOfNewRoom error: ${error.message}`);
  }
};

/**
 * Alerts a teacher about new feedback in their room.
 */
const notifyTeacherOfNewFeedback = async (teacherId, roomName, roomCode) => {
  try {
    const teacher = await Teacher.findById(teacherId, "pushToken");
    if (teacher && teacher.pushToken) {
      await sendPushNotifications(
        [teacher.pushToken],
        "New Feedback Received!",
        `Someone just submitted feedback in your room: ${roomName}`,
        { screen: "RoomDetail", roomCode }
      );
      console.log(`[PUSH] Sent feedback notification to teacher ${teacherId}.`);
    }
  } catch (error) {
    console.error(`[PUSH] notifyTeacherOfNewFeedback error: ${error.message}`);
  }
};

module.exports = {
  sendPushNotifications,
  notifyAllStudentsOfNewRoom,
  notifyTeacherOfNewFeedback,
};
