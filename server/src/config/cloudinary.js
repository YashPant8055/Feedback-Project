const cloudinary = require("cloudinary").v2;
const { env, hasCloudinaryConfig } = require("./env");

const configureCloudinary = () => {
  if (!hasCloudinaryConfig) {
    console.warn("[CLOUDINARY] Missing environment keys. Skipping Cloudinary setup.");
    return;
  }

  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });

  console.log("Cloudinary integrated:", {
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey ? "loaded" : "missing",
  });

  cloudinary.api
    .ping()
    .then(() => console.log("Cloudinary connection: success"))
    .catch((err) =>
      console.error("Cloudinary connection failed:", err.message)
    );
};

module.exports = { cloudinary, configureCloudinary };
