export const EMOTION_EMOJI_MAP = {
  happy: "\u{1F60A}",
  sad: "\u{1F622}",
  angry: "\u{1F620}",
  disgusted: "\u{1F922}",
  fearful: "\u{1F628}",
  surprised: "\u{1F62E}",
  neutral: "\u{1F610}",
};

export const FEEDBACK_CONFIG = {
  good: { label: "Good", color: "#59f0c2", bg: "rgba(89, 240, 194, 0.2)" },
  average: { label: "Average", color: "#ffd84d", bg: "rgba(255, 216, 77, 0.2)" },
  bad: { label: "Bad", color: "#ff5b7f", bg: "rgba(255, 91, 127, 0.2)" },
};

export const ANIMATION_SCREENS = {
  good: {
    emoji: "\u{1F60A}",
    title: "Great Vibes!",
    subtitle: "You look happy and engaged. Keep that positive energy going!",
    particleEmojis: ["\u{2728}", "\u{1F31F}", "\u{1F389}", "\u{1F496}", "\u{1F44D}"],
    gradient: ["rgba(89, 240, 194, 0.25)", "rgba(89, 240, 194, 0.08)"],
    accentColor: "#59f0c2",
  },
  average: {
    emoji: "\u{1F610}",
    title: "Feeling Okay",
    subtitle: "A neutral expression detected. Every moment is a fresh start!",
    particleEmojis: ["\u{1F4AD}", "\u{2615}", "\u{1F324}", "\u{1F33F}", "\u{1F54A}"],
    gradient: ["rgba(255, 216, 77, 0.25)", "rgba(255, 216, 77, 0.08)"],
    accentColor: "#ffd84d",
  },
  bad: {
    emoji: "\u{1F622}",
    title: "Hang In There",
    subtitle: "We noticed some tension. Take a breath — things will get better!",
    particleEmojis: ["\u{1F49C}", "\u{1F338}", "\u{1F30A}", "\u{2764}", "\u{1F91D}"],
    gradient: ["rgba(255, 91, 127, 0.25)", "rgba(255, 91, 127, 0.08)"],
    accentColor: "#ff5b7f",
  },
};
