const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");

// Public/Student routes (verified if exists)
router.get("/:roomCode/verify", roomController.verifyRoom);

// Protected Routes
router.use(authMiddleware);

router.post("/", roomController.createRoom);
router.get("/teacher/:teacherId", roomController.getTeacherRooms);
router.patch("/:roomCode", roomController.updateRoom);
router.patch("/:roomCode/status", roomController.updateRoomStatus);
router.delete("/:roomCode", roomController.deleteRoom);
router.get("/:roomCode/analytics", roomController.getAnalytics);
router.get("/:roomCode/export", roomController.exportRoom);

module.exports = router;
