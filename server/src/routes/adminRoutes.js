const express = require("express");
const router = express.Router();
const adminController = require("../controllers/AdminController");
const protect = require("../middleware/authMiddleware");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ success: false, message: "Access denied: Admins only" });
  }
};

// All admin routes are protected
router.use(protect);
router.use(isAdmin);

router.get("/stats", adminController.getStats);
router.get("/users", adminController.getAllUsers);
router.patch("/users/:id/approve", adminController.approveTeacher);
router.delete("/users/:id", adminController.deleteUser);
router.get("/rooms", adminController.getAllRooms);
router.delete("/rooms/:id", adminController.deleteRoom);
router.get("/payments", adminController.getPayments);

module.exports = router;
