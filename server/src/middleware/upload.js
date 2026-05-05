const multer = require("multer");
const path = require("path");
const os = require("os");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(os.tmpdir(), "feedback-uploads");
    if (!require("fs").existsSync(tmpDir)) {
      require("fs").mkdirSync(tmpDir, { recursive: true });
    }
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
});

module.exports = upload;
