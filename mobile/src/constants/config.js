import { NativeModules, Platform } from "react-native";

export const SESSION_STORAGE_KEY = "storyverse-session";
export const ACTIVE_ROOM_STORAGE_KEY = "active-room-session";

const DEFAULT_API_PORT = 4000;
const WEB_FALLBACK_API_URL = "http://localhost:4000";

let hasWarnedAboutMissingApiUrl = false;

const normalizeUrl = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : "";
};

const warnMissingApiUrl = (fallbackUrl) => {
  if (__DEV__ && !hasWarnedAboutMissingApiUrl) {
    hasWarnedAboutMissingApiUrl = true;
    console.warn(
      `[CONFIG] EXPO_PUBLIC_API_URL is not set. Falling back to ${fallbackUrl}. Set the env value before building for production.`
    );
  }
};

const getMetroHostApiUrl = () => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) {
    return "";
  }

  try {
    const parsed = new URL(scriptURL);
    return `${parsed.protocol}//${parsed.hostname}:${DEFAULT_API_PORT}`;
  } catch (_error) {
    return "";
  }
};

export function getApiBaseUrl() {
  const envUrl = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
  if (envUrl) {
    return envUrl;
  }

  warnMissingApiUrl(WEB_FALLBACK_API_URL);
  return WEB_FALLBACK_API_URL;
}

export const API_BASE_URL = getApiBaseUrl();

export const STORY_MODES = [
  {
    id: "daily",
    title: "Daily Story",
    description: "A fresh, curated experience just for today.",
  },
  {
    id: "infinite",
    title: "Infinite Flow",
    description: "Endless scrolling of personalized short stories.",
  },
  {
    id: "community",
    title: "Community Tales",
    description: "Top-rated stories shared by other users.",
  },
  {
    id: "visual",
    title: "Visual Journey",
    description: "Rich graphics and interactive storytelling.",
  },
];
