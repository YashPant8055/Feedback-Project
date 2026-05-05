import { SCREEN_THEMES } from "../constants/themeConstants";

export function getRandomTheme(previousName) {
  const themesArray = Object.values(SCREEN_THEMES);
  const options = themesArray.filter((theme) => theme.name !== previousName);
  const source = options.length > 0 ? options : themesArray;
  return source[Math.floor(Math.random() * source.length)];
}

export function getThemeByName(name) {
  return SCREEN_THEMES.find((t) => t.name === name) || SCREEN_THEMES[0];
}

export function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : clean;
  const numeric = parseInt(normalized, 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getResolvedAppearanceMode(appearanceMode, systemScheme) {
  if (appearanceMode === "system") {
    return systemScheme === "light" ? "light" : "dark";
  }

  return appearanceMode;
}

export function getDisplayTheme(baseTheme, appearanceMode) {
  if (appearanceMode === "light") {
    // For light mode, we want to ensure accent/secondary have enough contrast
    const isVeryLight = (hex) => {
      const clean = hex.replace("#", "");
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 200; // Very bright
    };

    const contrastColor = (hex) => {
      if (!isVeryLight(hex)) return hex;
      // Darken slightly for better contrast on white
      const clean = hex.replace("#", "");
      let r = Math.max(0, parseInt(clean.substring(0, 2), 16) - 40);
      let g = Math.max(0, parseInt(clean.substring(2, 4), 16) - 40);
      let b = Math.max(0, parseInt(clean.substring(4, 6), 16) - 40);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    const lightAccent = contrastColor(baseTheme.accent);
    const lightSecondary = contrastColor(baseTheme.secondary);

    return {
      ...baseTheme,
      accent: lightAccent,
      secondary: lightSecondary,
      background: "#f8fafc", // Softer slate-white
      panel: "#ffffff",
      textPrimary: "#0f172a", // Very dark slate
      textSecondary: "#475569", // Slate 600
      textMuted: "#64748b", // Slate 500
      cardBorder: "rgba(15, 23, 42, 0.08)",
      inputBackground: "rgba(15, 23, 42, 0.04)",
      inputBorder: "rgba(15, 23, 42, 0.12)",
      inputText: "#0f172a",
      noteText: "#64748b",
      onAccent: "#ffffff",
      onSecondary: "#ffffff",
      glowOne: hexToRgba(lightAccent, 0.12),
      glowTwo: hexToRgba(lightSecondary, 0.08),
      accentSoft: hexToRgba(lightAccent, 0.1),
    };
  }

  return {
    ...baseTheme,
    textPrimary: "#f1f5f9",
    textSecondary: "#cbd5e1",
    cardBorder: "rgba(255,255,255,0.06)",
    inputBackground: "rgba(255, 255, 255, 0.06)",
    inputBorder: "rgba(143, 200, 255, 0.18)",
    inputText: "#f1f5f9",
    noteText: "#94a3b8",
    onAccent: "#ffffff",
    onSecondary: "#ffffff",
  };
}
