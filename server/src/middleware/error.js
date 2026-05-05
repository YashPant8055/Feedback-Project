const multer = require("multer");

const errorHandler = (err, req, res, next) => {
  console.error(`🚨 Global Error: ${err.message}`);

  // Handle Multer/Cloudinary Timeout specifically
  if (err.http_code === 499 || err.name === "TimeoutError" || err.message.includes("Timeout")) {
    return res.status(504).json({
      message: "The upload took too long. Please try again with a smaller file or a faster connection.",
      error: "Gateway Timeout",
    });
  }

  // Handle Multer errors (e.g. file too large)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message: "File upload error",
      error: err.message,
    });
  }

  res.status(500).json({
    message: "An internal server error occurred",
    error: err.message,
  });
};

module.exports = errorHandler;
