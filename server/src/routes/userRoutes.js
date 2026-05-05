const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/profile", userController.getProfile);
router.patch("/preferences", userController.updatePreferences);
router.patch("/push-token", userController.updatePushToken);
router.post("/rooms/join", userController.joinRoom);
router.delete("/students/:studentId/history/:roomCode", userController.removeStudentHistory);
router.delete("/teachers/:teacherId/history/:roomCode", userController.removeTeacherHistory);
router.patch("/profile/image", userController.updateProfileImage);
router.patch("/profile/password", userController.updatePassword);

module.exports = router;
