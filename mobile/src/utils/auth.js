import AsyncStorage from "@react-native-async-storage/async-storage";
import { SESSION_STORAGE_KEY } from "../constants/config";

const TOKEN_KEY = "auth-token";

export const saveSession = async (user, token) => {
  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error("[AUTH] Error saving session:", error);
  }
};

export const getSession = async () => {
  try {
    const user = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return {
      user: user ? JSON.parse(user) : null,
      token: token || null,
    };
  } catch (error) {
    console.error("[AUTH] Error getting session:", error);
    return { user: null, token: null };
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error("[AUTH] Error clearing session:", error);
  }
};

export const getAuthHeader = async () => {
  const { token } = await getSession();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getAuthToken = async () => {
  const { token } = await getSession();
  return token || "";
};
