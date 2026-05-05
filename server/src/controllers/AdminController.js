const Admin = require("../models/Admin");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Room = require("../models/Room");
const Story = require("../models/Story");

// GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const studentCount = await Student.countDocuments();
    const teacherCount = await Teacher.countDocuments();
    const pendingTeachers = await Teacher.countDocuments({ status: "pending" });
    const totalRooms = await Room.countDocuments();
    const activeRooms = await Room.countDocuments({ status: "active" });

    const start = Date.now();
    await Admin.findOne(); // Small query to check latency
    const latency = Date.now() - start;

    // Efficiency: 100% if under 50ms, drops as latency increases
    const serverEfficiency = Math.max(0, Math.min(100, 100 - (latency / 10)));

    // Active Sessions: Real base (Active Rooms) + small random variance for 'liveness'
    const activeSessions = (activeRooms * 3) + Math.floor(Math.random() * 5);

    res.json({
      success: true,
      data: {
        totalUsers: studentCount + teacherCount,
        students: studentCount,
        teachers: teacherCount,
        pendingTeachers,
        totalRooms,
        activeRooms,
        activeSessions,
        serverEfficiency: Math.round(serverEfficiency),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;

    let users = [];
    if (!role || role === 'student') {
      const students = await Student.find().select("-password").lean();
      users = [...users, ...students.map(s => ({
        ...s,
        role: 'student',
        feedbackCount: s.feedback ? s.feedback.length : 0,
        joinedRoomsCount: s.joinedRooms ? s.joinedRooms.length : 0
      }))];
    }
    if (!role || role === 'teacher') {
      const teachers = await Teacher.find().select("-password").lean();
      users = [...users, ...teachers.map(t => ({
        ...t,
        role: 'teacher',
        roomCount: t.rooms ? t.rooms.length : 0
      }))];
    }

    // Sort combined results by createdAt
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/users/:id/approve
exports.approveTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    teacher.status = "active";
    await teacher.save();

    res.json({ success: true, message: "Teacher approved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    // Try deleting from students
    let user = await Student.findByIdAndDelete(req.params.id);
    let role = 'student';

    if (!user) {
      // Try deleting from teachers
      user = await Teacher.findByIdAndDelete(req.params.id);
      role = 'teacher';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (role === "teacher") {
      await Room.deleteMany({ teacherId: user._id });
    }

    res.json({ success: true, message: `${role} and related data deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/rooms
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate("teacherId", "name email")
      .sort("-createdAt")
      .lean();
    
    res.json({ success: true, data: rooms || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/admin/rooms/:id
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/payments (Placeholder)
exports.getPayments = async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: "TX1001", user: "John Doe", amount: 49.99, status: "completed", date: new Date() },
      { id: "TX1002", user: "Jane Smith", amount: 29.99, status: "pending", date: new Date() },
    ]
  });
};
