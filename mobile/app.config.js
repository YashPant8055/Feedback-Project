const config = {
  expo: {
    name: process.env.EXPO_APP_NAME || "Feedback",
    slug: process.env.EXPO_APP_SLUG || "mobile",
    scheme: process.env.EXPO_APP_SCHEME || "mobile",
    version: process.env.EXPO_APP_VERSION || "1.0.0",
    icon: "./assets/icon.png",
    newArchEnabled: false,
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#07111f"
    },
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    web: {
      favicon: "./assets/icon.png"
    },
    android: {
      package: process.env.ANDROID_PACKAGE || "com.yash8055.mobile",
      usesCleartextTraffic: true,
    },
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "d4503ee5-cdbe-4563-9686-60a9892ed17e",
      },
    },
    plugins: [
      "@react-native-google-signin/google-signin",
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow this app to use the camera for selfie feedback.",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.2.0",
            gradleProperties: {
              kotlinVersion: "2.2.0",
            },
          },
        },
      ],
    ],
  },
};

module.exports = config;
