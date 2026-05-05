const fs = require("fs");
const Story = require("../models/Story");
const { cloudinary } = require("../config/cloudinary");
const { env } = require("../config/env");

exports.getAllStories = async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stories", error: error.message });
  }
};

exports.getTeacherStories = async (req, res) => {
  try {
    const stories = await Story.find({ teacherId: req.params.teacherId }).sort({
      createdAt: -1,
    });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stories", error: error.message });
  }
};

exports.getStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }
    res.json(story);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch story", error: error.message });
  }
};

exports.uploadSingleClip = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log(`[UPLOAD-SINGLE] Starting Cloudinary upload for: ${req.file.path}`);

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        req.file.path,
        {
          folder: "feedback_project_stories",
          resource_type: "video",
          timeout: 300000,
        },
        (error, cloudinaryResult) => {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_error) {
            // Ignore temp file cleanup errors.
          }
          if (error) {
            return reject(error);
          }
          resolve(cloudinaryResult);
        }
      );
    });

    res.status(200).json({ url: result.secure_url, public_id: result.public_id });
  } catch (error) {
    console.error("[UPLOAD-SINGLE] Failed:", error.message);
    next(error);
  }
};

exports.createStory = async (req, res) => {
  try {
    const { title, landscape, mobile, cloudinaryIds, teacherId, teacherName } =
      req.body;
    if (!title || !landscape || !mobile || !cloudinaryIds || !teacherId) {
      return res.status(400).json({ message: "Missing required story fields" });
    }

    const newStory = new Story({
      title,
      landscape,
      mobile,
      cloudinaryIds,
      teacherId,
      teacherName,
    });
    await newStory.save();
    res.status(201).json(newStory);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create story record", error: error.message });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.cloudinaryIds && story.cloudinaryIds.length > 0) {
      for (const publicId of story.cloudinaryIds) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
      }
    } else if (story.cloudinaryId) {
      await cloudinary.uploader.destroy(story.cloudinaryId, {
        resource_type: "video",
      });
    }

    await Story.findByIdAndDelete(req.params.id);
    res.json({ message: "Story deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
};

exports.deleteMultipleClips = async (req, res) => {
  try {
    const { publicIds } = req.body;
    if (!publicIds || !Array.isArray(publicIds)) {
      return res.status(400).json({ message: "No publicIds provided" });
    }

    const results = [];
    for (const publicId of publicIds) {
      const deleteResult = await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });
      results.push({ publicId, status: deleteResult.result });
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ message: "Bulk delete failed", error: error.message });
  }
};

exports.getUploadSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: "feedback_project_stories",
      },
      env.cloudinary.apiSecret
    );

    res.json({
      signature,
      timestamp,
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      folder: "feedback_project_stories",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to generate signature", error: error.message });
  }
};
