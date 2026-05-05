const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { env } = require("../config/env");
const {
  buildStudentResponse,
  buildTeacherResponse,
  defaultPreferences,
} = require("../utils/helpers");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || (user.feedback ? "student" : "teacher"),
    },
    env.jwtSecret,
    { expiresIn: "30d" }
  );
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, and password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();
    const hashedPassword = await bcrypt.hash(String(password).trim(), 10);

    const existingTeacher = await Teacher.findOne({ email: normalizedEmail });
    const existingStudent = await Student.findOne({ email: normalizedEmail });

    if (existingTeacher || existingStudent) {
      return res.status(409).json({
        message: "An account already exists with this email",
      });
    }

if (role === "teacher") {
      const teacher = await Teacher.create({
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        preferences: {
          themeSettings: defaultPreferences.themeSettings,
        },
        status: "pending", // Teacher needs admin approval before logging in
      });

      return res.status(201).json({
        message: "Your registration request has been sent. Please wait for admin approval.",
        pending: true,
        user: {
          id: teacher._id,
          _id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          role: "teacher",
          status: "pending",
        },
      });
    }

    const student = await Student.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      preferences: defaultPreferences,
      feedback: [],
    });

    return res.status(201).json({
      message: "Student signup successful",
      user: buildStudentResponse(student),
      token: generateToken(student),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to sign up",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const incomingPassword = String(password).trim();

    const Admin = require("../models/Admin");
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (admin) {
      let passwordMatches = false;
      if (admin.password.startsWith("$2")) {
        passwordMatches = await bcrypt.compare(incomingPassword, admin.password);
      } else {
        passwordMatches = admin.password === incomingPassword;
        if (passwordMatches) {
          admin.password = await bcrypt.hash(incomingPassword, 10);
          await admin.save();
        }
      }
      if (passwordMatches) {
        return res.json({
          message: "Login successful",
          user: {
            id: admin._id,
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            role: "admin",
            status: admin.status,
          },
          token: generateToken(admin),
        });
      }
    }

    const student = await Student.findOne({ email: normalizedEmail });
    if (student) {
      let passwordMatches = false;

      if (student.password.startsWith("$2")) {
        passwordMatches = await bcrypt.compare(incomingPassword, student.password);
      } else {
        passwordMatches = student.password === incomingPassword;
        if (passwordMatches) {
          student.password = await bcrypt.hash(incomingPassword, 10);
          await student.save();
        }
      }

      if (!passwordMatches) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.json({
        message: "Login successful",
        user: buildStudentResponse(student),
        token: generateToken(student),
      });
    }

const teacher = await Teacher.findOne({ email: normalizedEmail });
    if (teacher) {
      // Check if teacher is still pending approval
      if (teacher.status === "pending") {
        return res.status(403).json({ 
          message: "Your account is pending approval. Please wait for admin to approve your request.",
          pending: true 
        });
      }

      let passwordMatches = false;

      if (teacher.password.startsWith("$2")) {
        passwordMatches = await bcrypt.compare(incomingPassword, teacher.password);
      } else {
        passwordMatches = teacher.password === incomingPassword;
        if (passwordMatches) {
          teacher.password = await bcrypt.hash(incomingPassword, 10);
          await teacher.save();
        }
      }

      if (!passwordMatches) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.json({
        message: "Login successful",
        user: buildTeacherResponse(teacher),
        token: generateToken(teacher),
      });
    }

    return res.status(401).json({ message: "Invalid email or password" });
  } catch (error) {
    console.error(`[AUTH] Login error: ${error.message}`);
    return res.status(500).json({
      message: "Failed to log in",
      error: error.message,
    });
  }
};
