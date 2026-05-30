const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/google", authController.googleLogin);
router.post("/verify-email", authController.verifyEmailOtp);
router.post("/resend-verification", authController.resendVerificationOtp);
router.post("/send-login-otp", authController.sendLoginOtp);
router.post("/verify-login-otp", authController.verifyLoginOtp);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
