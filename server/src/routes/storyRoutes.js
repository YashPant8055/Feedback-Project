const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");

// Public list
router.get("/", storyController.getAllStories);

// Protected routes for management (specific paths MUST come before /:id)
router.get("/teacher/:teacherId", authMiddleware, storyController.getTeacherStories);
router.get("/upload-signature", authMiddleware, storyController.getUploadSignature);
router.post("/upload-single", authMiddleware, upload.single("file"), storyController.uploadSingleClip);
router.post("/create", authMiddleware, storyController.createStory);
router.post("/delete-clips", authMiddleware, storyController.deleteMultipleClips);
router.delete("/:id", authMiddleware, storyController.deleteStory);

// Generic ID route must come last to avoid shadowing other routes
router.get("/:id", storyController.getStory);

module.exports = router;
