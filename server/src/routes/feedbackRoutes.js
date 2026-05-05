const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/", feedbackController.submitFeedback);
router.get("/", feedbackController.getFeedbackHistory);
router.delete("/:feedbackId", feedbackController.deleteFeedback);

module.exports = router;
