const nodemailer = require("nodemailer");
const { env } = require("../config/env");

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!env.gmail.user || !env.gmail.appPassword) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are required to send OTP emails");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.gmail.user,
      pass: env.gmail.appPassword,
    },
  });

  return transporter;
};

const sendOtpEmail = async ({ to, name, otp, purpose }) => {
  const isPasswordReset = purpose === "password-reset";
  const subject = isPasswordReset
    ? "Your password reset code"
    : "Verify your email address";

  const text = [
    `Hi ${name || "there"},`,
    "",
    `Your ${isPasswordReset ? "password reset" : "email verification"} code is: ${otp}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  await getTransporter().sendMail({
    from: `"Feedback Project" <${env.gmail.user}>`,
    to,
    subject,
    text,
  });
};

module.exports = {
  sendOtpEmail,
};
