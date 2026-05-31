import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_SETTINGS_STORAGE_KEY, STORY_MODE_STORAGE_KEY, DEFAULT_THEME_SETTINGS } from '../constants/themeConstants';
import { getRandomTheme, getThemeByName, getResolvedAppearanceMode, getDisplayTheme } from '../utils/themeUtils';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();

  const [themeSettings, setThemeSettings] = useState(DEFAULT_THEME_SETTINGS);
  const [storyModePreference, setStoryModePreference] = useState("random");
  const [showIntro, setShowIntro] = useState(true);

  const [theme, setTheme] = useState(() => getRandomTheme());

  const resolvedAppearanceMode = useMemo(() => {
    if (showIntro) return "dark";
    return getResolvedAppearanceMode(themeSettings.appearanceMode, systemColorScheme);
  }, [showIntro, themeSettings.appearanceMode, systemColorScheme]);

  const displayTheme = useMemo(() => {
    return { ...getDisplayTheme(theme, resolvedAppearanceMode), mode: resolvedAppearanceMode };
  }, [theme, resolvedAppearanceMode]);

  const handleThemeSettingsChange = useCallback(async (nextSettings) => {
    setThemeSettings(nextSettings);
    await AsyncStorage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    setTheme((current) =>
      nextSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(nextSettings.selectedThemeName)
    );
  }, []);

  const handleStoryModePreferenceChange = useCallback(async (nextPreference) => {
    setStoryModePreference(nextPreference);
    await AsyncStorage.setItem(STORY_MODE_STORAGE_KEY, nextPreference);
  }, []);

  const rotateTheme = useCallback(() => {
    setTheme((current) => getRandomTheme(current?.name));
  }, []);

  const initializeTheme = useCallback(async (storedThemeSettings, storedStoryMode) => {
    const parsedThemeSettings = storedThemeSettings || null;
    const nextSettings = {
      ...DEFAULT_THEME_SETTINGS,
      ...(parsedThemeSettings || {}),
    };
    setThemeSettings(nextSettings);
    setStoryModePreference(storedStoryMode || nextSettings.themeSettings?.storyModePreference || "random");
    setTheme((current) =>
      nextSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(nextSettings.selectedThemeName)
    );
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, themeSettings, displayTheme, showIntro,
      storyModePreference, resolvedAppearanceMode,
      setShowIntro, setThemeSettings, setTheme,
      handleThemeSettingsChange, handleStoryModePreferenceChange,
      rotateTheme, initializeTheme, setStoryModePreference,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
