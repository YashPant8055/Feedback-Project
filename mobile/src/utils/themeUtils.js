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
    const contrastColor = (hex) => {
      const clean = hex.replace("#", "");
      let r = parseInt(clean.substring(0, 2), 16);
      let g = parseInt(clean.substring(2, 4), 16);
      let b = parseInt(clean.substring(4, 6), 16);

      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      if (brightness > 170) {
        const excess = brightness - 170;
        const factor = 1 - (excess / 255) * 0.35;
        r = Math.floor(r * factor);
        g = Math.floor(g * factor);
        b = Math.floor(b * factor);
      }
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    const lightAccent = contrastColor(baseTheme.accent);
    const lightSecondary = contrastColor(baseTheme.secondary);

    return {
      ...baseTheme,
      accent: lightAccent,
      secondary: lightSecondary,
      background: "#f0f4f8",
      panel: "#ffffff",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      cardBorder: "rgba(15, 23, 42, 0.1)",
      inputBackground: "#f8fafc",
      inputBorder: "rgba(15, 23, 42, 0.18)",
      inputText: "#0f172a",
      noteText: "#64748b",
      onAccent: "#ffffff",
      onSecondary: "#ffffff",
      glowOne: hexToRgba(lightAccent, 0.2),
      glowTwo: hexToRgba(lightSecondary, 0.15),
      accentSoft: hexToRgba(lightAccent, 0.15),
    };
  }

  // Dark Mode guarantees
  return {
    ...baseTheme,
    textPrimary: "#ffffff",
    textSecondary: "#e2e8f0",
    textMuted: "#94a3b8",
    cardBorder: "rgba(255,255,255,0.12)",
    inputBackground: "rgba(255, 255, 255, 0.1)",
    inputBorder: "rgba(255, 255, 255, 0.2)",
    inputText: "#ffffff",
    noteText: "#94a3b8",
    onAccent: "#ffffff",
    onSecondary: "#ffffff",
  };
}
