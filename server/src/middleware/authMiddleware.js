const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Admin = require("../models/Admin");
const { env } = require("../config/env");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const queryToken =
      typeof req.query?.token === "string" ? req.query.token.trim() : "";
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.replace("Bearer ", "")
        : "";
    const token = bearerToken || queryToken;

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, env.jwtSecret);

    let user = await Student.findById(decoded.id);
    let role = "student";

    if (!user) {
      user = await Teacher.findById(decoded.id);
      role = "teacher";
    }

    if (!user) {
      user = await Admin.findById(decoded.id);
      if (user) {
        role = user.role;
      }
    }

    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    req.user = user;
    req.role = role;
    next();
  } catch (err) {
    console.error(`[AUTH] Middleware error: ${err.message}`);
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = protect;
