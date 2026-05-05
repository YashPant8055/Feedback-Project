import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;
  
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return;
    }
    
    // Check if projectId is available
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  }

  return token;
}

export function addNotificationListeners(onReceived, onResponse) {
  if (Platform.OS === 'web') {
    return () => {}; // Return a no-op cleanup function
  }

  const notificationListener = Notifications.addNotificationReceivedListener(onReceived);
  const responseListener = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    if (notificationListener) notificationListener.remove();
    if (responseListener) responseListener.remove();
  };
}
