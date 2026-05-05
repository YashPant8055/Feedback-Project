const config = {
  expo: {
    name: "Feedback",
    slug: "mobile",
    scheme: "mobile",
    version: "1.0.0",
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
      package: "com.yash8055.mobile",
      usesCleartextTraffic: true,
    },
    extra: {
      eas: {
        projectId: "1ed4d569-1540-4cc5-8dfc-797dc83ad301",
      },
    },
    plugins: [
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
