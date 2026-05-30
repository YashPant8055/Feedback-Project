const DEFAULT_JWT_SECRET = "your_super_secret_key_123";

const trimEnvValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const parsePort = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4000;
};

const env = {
  nodeEnv: trimEnvValue(process.env.NODE_ENV) || "development",
  port: parsePort(process.env.PORT),
  mongoUri: trimEnvValue(process.env.MONGODB_URI),
  jwtSecret: trimEnvValue(process.env.JWT_SECRET) || DEFAULT_JWT_SECRET,
  corsOrigin: trimEnvValue(process.env.CORS_ORIGIN) || "*",
  googleClientIds: [
    trimEnvValue(process.env.GOOGLE_CLIENT_ID),
    trimEnvValue(process.env.GOOGLE_WEB_CLIENT_ID),
    trimEnvValue(process.env.GOOGLE_ANDROID_CLIENT_ID),
    trimEnvValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    trimEnvValue(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  ].filter(Boolean),
  gmail: {
    user: trimEnvValue(process.env.GMAIL_USER),
    appPassword: trimEnvValue(process.env.GMAIL_APP_PASSWORD),
  },
  cloudinary: {
    cloudName: trimEnvValue(process.env.CLOUDINARY_CLOUD_NAME),
    apiKey: trimEnvValue(process.env.CLOUDINARY_API_KEY),
    apiSecret: trimEnvValue(process.env.CLOUDINARY_API_SECRET),
  },
};

const hasCloudinaryConfig = Boolean(
  env.cloudinary.cloudName &&
    env.cloudinary.apiKey &&
    env.cloudinary.apiSecret
);

const validateServerEnv = () => {
  const missing = [];

  if (!env.mongoUri) {
    missing.push("MONGODB_URI");
  }

  if (missing.length > 0) {
    console.error(
      `[ENV] Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  if (env.jwtSecret === DEFAULT_JWT_SECRET) {
    console.warn(
      "[ENV] JWT_SECRET is not set. Using the development fallback secret. Set a unique value before production."
    );
  }

  if (!hasCloudinaryConfig) {
    console.warn(
      "[ENV] Cloudinary variables are incomplete. Story upload features will stay unavailable until they are set."
    );
  }
};

module.exports = {
  DEFAULT_JWT_SECRET,
  env,
  hasCloudinaryConfig,
  validateServerEnv,
};
