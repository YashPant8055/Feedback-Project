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
    // For light mode, we must guarantee that the accent colors are readable against a white background.
    // If the color is too bright, we darken it significantly.
    const contrastColor = (hex) => {
      const clean = hex.replace("#", "");
      let r = parseInt(clean.substring(0, 2), 16);
      let g = parseInt(clean.substring(2, 4), 16);
      let b = parseInt(clean.substring(4, 6), 16);
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      if (brightness > 140) {
        // Scale down RGB to darken the color by 45% to ensure it pops on white
        r = Math.floor(r * 0.55);
        g = Math.floor(g * 0.55);
        b = Math.floor(b * 0.55);
      }
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
      textPrimary: "#0f172a", // Very dark slate (high contrast)
      textSecondary: "#334155", // Slate 700 (high contrast)
      textMuted: "#475569", // Slate 600 (better contrast than 500)
      cardBorder: "rgba(15, 23, 42, 0.12)",
      inputBackground: "rgba(15, 23, 42, 0.05)",
      inputBorder: "rgba(15, 23, 42, 0.15)",
      inputText: "#0f172a",
      noteText: "#475569",
      onAccent: "#ffffff",
      onSecondary: "#ffffff",
      glowOne: hexToRgba(lightAccent, 0.15),
      glowTwo: hexToRgba(lightSecondary, 0.12),
      accentSoft: hexToRgba(lightAccent, 0.12),
    };
  }

  // Dark Mode guarantees
  return {
    ...baseTheme,
    textPrimary: "#ffffff", // Pure white for max readability
    textSecondary: "#e2e8f0", // Very bright slate
    textMuted: "#cbd5e1", // Bright slate for readable subtext
    cardBorder: "rgba(255,255,255,0.08)",
    inputBackground: "rgba(255, 255, 255, 0.08)",
    inputBorder: "rgba(255, 255, 255, 0.15)",
    inputText: "#ffffff",
    noteText: "#94a3b8",
    onAccent: "#ffffff", // Ensure text inside accent buttons is white
    onSecondary: "#ffffff",
  };
}
