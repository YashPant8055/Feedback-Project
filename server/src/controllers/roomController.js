const Room = require("../models/Room");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const ExcelJS = require("exceljs");
const { normalizeRoomCode, generateUniqueRoomCode, autoCloseRoomIfExpired, formatDate } = require("../utils/helpers");
const { notifyAllStudentsOfNewRoom } = require("../services/notificationService");
const { emitToRoom } = require("../services/socketService");

exports.createRoom = async (req, res) => {
  try {
    const { 
      roomName, subject, description, isAnonymous, 
      durationMinutes, feedbackLimitPerStudent, 
      enabledFeedbackModes, storyQuestions, question,
      maxStudents
    } = req.body;
    const teacherId = req.user._id;

    if (!roomName) {
      return res.status(400).json({ message: "roomName is required" });
    }

    const roomCode = await generateUniqueRoomCode();
    const duration = 0; // Force unlimited time
    const expiresAt = null;

    const room = await Room.create({
      roomCode,
      roomName: String(roomName).trim(),
      subject: subject || "",
      description: description || "",
      isAnonymous: !!isAnonymous,
      teacherId: req.user._id,
      teacherName: req.user.name,
      teacherEmail: req.user.email,
      durationMinutes: duration,
      expiresAt: expiresAt,
      feedbackLimitPerStudent: parseInt(feedbackLimitPerStudent) || 0,
      maxStudents: parseInt(maxStudents) || 0,
      enabledFeedbackModes: enabledFeedbackModes || ["emoji", "selfie", "written", "story"],
      storyQuestions: storyQuestions || [],
      question: question || "How was the session?",
      studentIds: [],
      feedback: [],
    });

    // Save to teacher's rooms history
    const teacher = req.user;
    teacher.rooms = teacher.rooms || [];
    teacher.rooms.push({
      roomCode: room.roomCode,
      roomName: room.roomName,
      subject: room.subject,
      description: room.description,
      createdAt: new Date(),
    });
    await teacher.save();

    // Notify all students
    notifyAllStudentsOfNewRoom(room.roomName, room.roomCode, room.teacherName);

    return res.status(201).json({
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create room",
      error: error.message,
    });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { 
      roomName, subject, description, isAnonymous, 
      durationMinutes, feedbackLimitPerStudent,
      enabledFeedbackModes, storyQuestions, question,
      maxStudents
    } = req.body;
    const normalizedCode = normalizeRoomCode(roomCode);

    const updateFields = {};
    if (roomName !== undefined) updateFields.roomName = roomName;
    if (subject !== undefined) updateFields.subject = subject;
    if (description !== undefined) updateFields.description = description;
    if (isAnonymous !== undefined) updateFields.isAnonymous = !!isAnonymous;
    
    if (durationMinutes !== undefined) {
      updateFields.durationMinutes = 0;
      updateFields.expiresAt = null;
    }
    
    if (feedbackLimitPerStudent !== undefined) {
      updateFields.feedbackLimitPerStudent = parseInt(feedbackLimitPerStudent) || 0;
    }
    if (maxStudents !== undefined) {
      updateFields.maxStudents = parseInt(maxStudents) || 0;
    }

    if (enabledFeedbackModes !== undefined) updateFields.enabledFeedbackModes = enabledFeedbackModes;
    if (storyQuestions !== undefined) updateFields.storyQuestions = storyQuestions;
    if (question !== undefined) updateFields.question = question;

    const room = await Room.findOneAndUpdate(
      { roomCode: normalizedCode, teacherId: req.user._id },
      { $set: updateFields },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    return res.json({ message: "Room updated successfully", room });
  } catch (error) {
    return res.status(500).json({ message: "Error updating room", error: error.message });
  }
};

exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { status } = req.body;

    if (!status || !["active", "closed"].includes(status)) {
      return res.status(400).json({ message: "Valid status (active/closed) is required" });
    }

    const normalizedCode = normalizeRoomCode(roomCode);

    const room = await Room.findOneAndUpdate(
      { roomCode: normalizedCode, teacherId: req.user._id },
      { status },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    if (status === "closed") {
      emitToRoom(normalizedCode, "room-closed", { roomCode: normalizedCode });
    }

    return res.json({
      message: `Room status updated to ${status}`,
      room,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update room status",
      error: error.message,
    });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const normalizedCode = normalizeRoomCode(roomCode);

    const roomRecord = await Room.findOneAndDelete({ roomCode: normalizedCode, teacherId: req.user._id });
    if (!roomRecord) {
      return res.status(404).json({ message: "Room not found or unauthorized" });
    }

    // Cleanup logic
    await Student.updateMany(
      {},
      { 
        $pull: { 
          joinedRooms: { roomCode: normalizedCode },
          feedback: { roomCode: normalizedCode } 
        } 
      }
    );

    await Teacher.updateOne(
      { _id: req.user._id },
      { $pull: { rooms: { roomCode: normalizedCode } } }
    );

    return res.json({ message: "Room deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete room",
      error: error.message,
    });
  }
};

exports.getTeacherRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
    return res.json(rooms);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch rooms",
      error: error.message,
    });
  }
};

exports.verifyRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const normalizedCode = normalizeRoomCode(roomCode);

    let room = await Room.findOne({ roomCode: normalizedCode });
    if (!room) {
      return res.status(404).json({ exists: false, message: "Room not found" });
    }

    room = await autoCloseRoomIfExpired(room);

    return res.json({ 
      exists: true, 
      room 
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to verify room",
      error: error.message,
    });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const normalizedCode = normalizeRoomCode(roomCode);

    let room = await Room.findOne({ roomCode: normalizedCode });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    room = await autoCloseRoomIfExpired(room);

    const studentList = await Student.find(
      { _id: { $in: room.studentIds } },
      "name email"
    );

    let feedbackEntries = [...(room.feedback || [])].sort((a, b) => b.createdAt - a.createdAt);
    let finalStudentList = studentList;

    if (room.isAnonymous) {
      feedbackEntries = feedbackEntries.map(entry => ({
        ...entry.toObject(),
        studentName: "Anonymous Student",
        studentId: undefined,
      }));

      finalStudentList = studentList.map(s => ({
        _id: s._id,
        name: "Anonymous Student",
        email: "hidden@anonymous.com"
      }));
    }

    const summary = { good: 0, average: 0, bad: 0, total: 0 };
    feedbackEntries.forEach((entry) => {
      if (entry.review === "good") summary.good++;
      else if (entry.review === "average") summary.average++;
      else if (entry.review === "bad") summary.bad++;
      summary.total++;
    });

    const emotionSummary = {
      good: summary.total > 0 ? Math.round((summary.good / summary.total) * 100) : 0,
      average: summary.total > 0 ? Math.round((summary.average / summary.total) * 100) : 0,
      bad: summary.total > 0 ? Math.round((summary.bad / summary.total) * 100) : 0,
    };

    return res.json({
      roomName: room.roomName,
      isAnonymous: room.isAnonymous,
      feedback: feedbackEntries,
      emotionSummary,
      feedbackCount: summary.total,
      connectedStudents: finalStudentList,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch room analytics",
      error: error.message,
    });
  }
};

exports.exportRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const normalizedCode = normalizeRoomCode(roomCode);

    let room = await Room.findOne({ roomCode: normalizedCode });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    room = await autoCloseRoomIfExpired(room);

    const studentIds = room.feedback.map(f => f.studentId).filter(Boolean);
    const students = await Student.find({ _id: { $in: studentIds } }, "name email");
    const studentMap = students.reduce((map, s) => {
      map[s._id.toString()] = s;
      return map;
    }, {});

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Room Feedback");

    worksheet.mergeCells("A1:F1");
    worksheet.getCell("A1").value = "ROOM FEEDBACK REPORT";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.getCell("A2").value = "Room Name:";
    worksheet.getCell("B2").value = room.roomName;
    worksheet.getCell("A3").value = "Room Code:";
    worksheet.getCell("B3").value = normalizedCode;
    worksheet.getCell("A4").value = "Generated On:";
    worksheet.getCell("B4").value = formatDate(new Date());

    worksheet.columns = [
      { header: "Sr. No.", key: "srno", width: 10 },
      { header: "Student Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 35 },
      { header: "Vibe", key: "vibe", width: 15 },
      { header: "Feedback Type", key: "detail", width: 60 },
      { header: "Date Submitted", key: "date", width: 25 }
    ];

    const headerRow = worksheet.getRow(6);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6366F1" }
    };

    room.feedback.forEach((entry, index) => {
      const student = entry.studentId ? studentMap[entry.studentId.toString()] : null;
      const studentName = room.isAnonymous ? "Anonymous Student" : (entry.studentName || student?.name || "Unknown");
      const email = (room.isAnonymous || !student) ? "hidden@anonymous.com" : student.email;

      let detail = `[${String(entry.type).toUpperCase()}]`;
      if (entry.emoji || entry.emotion) detail += ` ${entry.emoji || entry.emotion}`;
      if (entry.message) detail += ` - ${entry.message.replace(/\n/g, " ")}`;

      worksheet.addRow({
        srno: index + 1,
        name: studentName,
        email: email,
        vibe: entry.review || "",
        detail: detail,
        date: entry.createdAt ? formatDate(entry.createdAt) : ""
      });
    });

    worksheet.getColumn("detail").alignment = { wrapText: true, vertical: "middle" };
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Room_${normalizedCode}_Feedback.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(`[EXPORT] Error: ${error.message}`);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to export room data", error: error.message });
    }
  }
};
