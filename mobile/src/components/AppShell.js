import React from 'react';
import { View, Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import styles from "../styles/globalStyles";
import AppContent from './AppContent';
import ErrorBoundary from './ErrorBoundary';
export default function AppShell() {
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const isLight = systemScheme === "light";
  const bottomGap = Platform.OS === "android" ? Math.max(insets.bottom, 18) : 0;
  const finalBottomPadding = Platform.OS === 'web' ? 0 : bottomGap;

  const errorTheme = isLight ? {
    background: "#f0f4f8",
    textPrimary: "#0f172a",
    textMuted: "#64748b",
    accent: "#4f46e5",
    onAccent: "#ffffff",
  } : {
    background: "#07111f",
    textPrimary: "#ffffff",
    textMuted: "#94a3b8",
    accent: "#4f46e5",
    onAccent: "#ffffff",
  };

  return (
    <View style={[styles.webRootWrapper, { backgroundColor: errorTheme.background }]}>
      <View style={[styles.appShell, { backgroundColor: errorTheme.background, paddingBottom: finalBottomPadding }]}>
        <ErrorBoundary theme={errorTheme}>
          <AppContent />
        </ErrorBoundary>
      </View>
    </View>
  );
}

