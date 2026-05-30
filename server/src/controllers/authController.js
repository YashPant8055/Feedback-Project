const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { env } = require("../config/env");
const { sendOtpEmail } = require("../services/emailService");
const {
  buildStudentResponse,
  buildTeacherResponse,
  defaultPreferences,
} = require("../utils/helpers");

const generateToken = (user, role) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: role || "student",
    },
    env.jwtSecret,
    { expiresIn: "30d" }
  );
};

const OTP_TTL_MS = 10 * 60 * 1000;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otp) =>
  crypto
    .createHash("sha256")
    .update(`${String(otp).trim()}:${env.jwtSecret}`)
    .digest("hex");

const findAccountByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const student = await Student.findOne({ email: normalizedEmail });
  if (student) {
    return { user: student, role: "student" };
  }

  const teacher = await Teacher.findOne({ email: normalizedEmail });
  if (teacher) {
    return { user: teacher, role: teacher.role || "teacher" };
  }

  return { user: null, role: "" };
};

const setOtpAndSend = async (user, purpose) => {
  const otp = generateOtp();
  console.log(`[AUTH] OTP for ${user.email}: ${otp} (${purpose})`);
  user.otp = {
    codeHash: hashOtp(otp),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  };
  await user.save();
  try {
    await sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
      purpose,
    });
  } catch (err) {
    console.warn(`[AUTH] Failed to send OTP email to ${user.email}: ${err.message}`);
  }
};

const verifyUserOtp = (user, otp, purpose) => {
  if (!user?.otp?.codeHash || user.otp.purpose !== purpose) {
    return false;
  }

  if (!user.otp.expiresAt || new Date(user.otp.expiresAt).getTime() < Date.now()) {
    return false;
  }

  return user.otp.codeHash === hashOtp(otp);
};

const clearOtp = (user) => {
  user.otp = {
    codeHash: "",
    purpose: "",
    expiresAt: null,
  };
};

const buildAuthPayload = (user, role, message = "Login successful") => ({
  message,
  user: role === "student" ? buildStudentResponse(user) : buildTeacherResponse(user),
  token: generateToken(user, role),
});

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const trimmedName = String(name).trim();
    const hashedPassword = await bcrypt.hash(String(password).trim(), 10);

    const existingTeacher = await Teacher.findOne({ email: normalizedEmail });
    const existingStudent = await Student.findOne({ email: normalizedEmail });

    if (existingStudent && role === "teacher") {
      return res.status(409).json({
        message: "This email is already registered as a student",
      });
    }

    if (existingTeacher && role !== "teacher") {
      return res.status(409).json({
        message: "This email is already registered as a teacher",
      });
    }

if (role === "teacher") {
      if (existingTeacher) {
        existingTeacher.name = trimmedName;
        existingTeacher.password = hashedPassword;
        existingTeacher.emailVerified = false;
        existingTeacher.status = "pending";
        existingTeacher.otp = { codeHash: "", purpose: "", expiresAt: null };
        await existingTeacher.save();
        await setOtpAndSend(existingTeacher, "email-verification");
        return res.status(200).json({
          message: "A verification code has been sent to your email.",
          pendingVerification: true,
          email: existingTeacher.email,
        });
      }

      const teacher = await Teacher.create({
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        preferences: {
          themeSettings: defaultPreferences.themeSettings,
        },
        emailVerified: false,
        status: "pending",
      });

      await setOtpAndSend(teacher, "email-verification");

      return res.status(201).json({
        message: "A verification code has been sent to your email.",
        pendingVerification: true,
        email: teacher.email,
      });
    }

    if (existingStudent) {
      existingStudent.name = trimmedName;
      existingStudent.password = hashedPassword;
      existingStudent.emailVerified = true;
      await existingStudent.save();
      return res.status(200).json(buildAuthPayload(existingStudent, "student", "Account created successfully"));
    }

    const student = await Student.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      preferences: defaultPreferences,
      feedback: [],
      emailVerified: true,
    });

    return res.status(201).json(buildAuthPayload(student, "student", "Account created successfully"));
  } catch (error) {
    console.error(`[AUTH] Signup error: ${error.message}`, error.stack);
    return res.status(500).json({
      message: "Failed to sign up",
      error: error.message,
    });
  }
};

exports.sendLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    await setOtpAndSend(student, "login");
    return res.json({ message: "Login code sent to your email.", email: student.email });
  } catch (error) {
    console.error(`[AUTH] Send login OTP error: ${error.message}`);
    return res.status(500).json({ message: "Failed to send login code", error: error.message });
  }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    if (!verifyUserOtp(student, otp, "login")) {
      return res.status(400).json({ message: "Invalid or expired login code" });
    }

    clearOtp(student);
    await student.save();

    return res.json(buildAuthPayload(student, "student", "Login successful"));
  } catch (error) {
    console.error(`[AUTH] Verify login OTP error: ${error.message}`);
    return res.status(500).json({ message: "Failed to verify login code", error: error.message });
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

    const normalizedEmail = normalizeEmail(email);
    const incomingPassword = String(password).trim();

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
        return res.status(401).json({
          message: "Invalid email or password. Use 'Forgot Password' to reset or sign in with Google.",
        });
      }

      if (student.emailVerified === false) {
        student.emailVerified = true;
        await student.save();
      }

      return res.json(buildAuthPayload(student, "student"));
    }

    const teacher = await Teacher.findOne({ email: normalizedEmail });
    if (teacher) {
      if (teacher.emailVerified === false) {
        return res.status(403).json({
          message: "Please verify your email before logging in.",
          pendingVerification: true,
          email: teacher.email,
        });
      }

      if (teacher.status === "pending") {
        return res.status(403).json({
          message: "Your account is pending approval. Please wait for admin to activate your request.",
          pending: true,
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
        return res.status(401).json({
          message: "Invalid email or password. Use 'Forgot Password' to reset or sign in with Google.",
        });
      }

      return res.json(buildAuthPayload(teacher, teacher.role || "teacher"));
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

exports.resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const { user } = await findAccountByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    if (user.emailVerified !== false) {
      return res.json({ message: "This email is already verified." });
    }

    await setOtpAndSend(user, "email-verification");
    return res.json({
      message: "A new verification code has been sent.",
      pendingVerification: true,
      email: user.email,
    });
  } catch (error) {
    console.error(`[AUTH] Resend verification error: ${error.message}`);
    return res.status(500).json({
      message: "Failed to send verification code",
      error: error.message,
    });
  }
};

exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const { user, role } = await findAccountByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    if (!verifyUserOtp(user, otp, "email-verification")) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.emailVerified = true;
    clearOtp(user);
    await user.save();

    if (role !== "student") {
      return res.json({
        message: "Email verified. Your account is now pending admin approval. Please wait for admin to activate your request.",
        pending: true,
        email: user.email,
      });
    }

    return res.json(buildAuthPayload(user, role, "Email verified successfully"));
  } catch (error) {
    console.error(`[AUTH] Verify email error: ${error.message}`);
    return res.status(500).json({
      message: "Failed to verify email",
      error: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const { user } = await findAccountByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    await setOtpAndSend(user, "password-reset");
    return res.json({
      message: "A password reset code has been sent to your email.",
      email: user.email,
    });
  } catch (error) {
    console.error(`[AUTH] Forgot password error: ${error.message}`);
    return res.status(500).json({
      message: "Failed to send password reset code",
      error: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: "email, otp, and password are required" });
    }

    if (String(password).trim().length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const { user, role } = await findAccountByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    if (!verifyUserOtp(user, otp, "password-reset")) {
      return res.status(400).json({ message: "Invalid or expired password reset code" });
    }

    user.password = await bcrypt.hash(String(password).trim(), 10);
    user.emailVerified = true;
    clearOtp(user);

    if (role !== "student" && user.status === "pending") {
      user.status = "active";
    }

    await user.save();

    return res.json(buildAuthPayload(user, role, "Password reset successful"));
  } catch (error) {
    console.error(`[AUTH] Reset password error: ${error.message}`);
    return res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google ID token is required" });
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    
    if (!response.ok) {
      const errData = await response.json();
      return res.status(401).json({
        message: "Invalid Google ID token",
        error: errData.error_description || "Token verification failed",
      });
    }

    const payload = await response.json();
    const { email, name, picture, aud, email_verified: emailVerified } = payload;

    if (!email) {
      return res.status(400).json({ message: "Email not provided in Google profile" });
    }

    if (emailVerified !== "true" && emailVerified !== true) {
      return res.status(401).json({ message: "Google email is not verified" });
    }

    if (env.googleClientIds.length > 0 && !env.googleClientIds.includes(aud)) {
      return res.status(401).json({
        message: "Google token was not issued for this app",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if the user is a teacher
    const teacher = await Teacher.findOne({ email: normalizedEmail });
    if (teacher) {
      if (teacher.emailVerified === false) {
        teacher.emailVerified = true;
      }

      if (teacher.status === "pending") {
        await teacher.save();
        return res.status(403).json({
          message: "Your account is pending approval. Please wait for admin to activate your request.",
          pending: true,
        });
      }

      if (picture && !teacher.profileImage) {
        teacher.profileImage = picture;
      }

      await teacher.save();

      return res.json(buildAuthPayload(teacher, teacher.role || "teacher", "Google login successful"));
    }

    // Check if the user is a student
    let student = await Student.findOne({ email: normalizedEmail });
    if (!student) {
      // Auto-create student
      const randomPassword = require("crypto").randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      student = await Student.create({
        name: name || email.split("@")[0] || "Student",
        email: normalizedEmail,
        password: hashedPassword,
        profileImage: picture || "",
        preferences: defaultPreferences,
        feedback: [],
        emailVerified: true,
      });
    } else {
      if (picture && !student.profileImage) {
        student.profileImage = picture;
      }
      if (student.emailVerified === false) {
        student.emailVerified = true;
      }
      await student.save();
    }

    return res.json(buildAuthPayload(student, "student", "Google login successful"));

  } catch (error) {
    console.error(`[AUTH] Google login error: ${error.message}`);
    return res.status(500).json({
      message: "Failed to log in with Google",
      error: error.message,
    });
  }
};
