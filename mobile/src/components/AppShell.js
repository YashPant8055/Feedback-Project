import React from 'react';
import { View, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import styles from "../styles/globalStyles";
import AppContent from './AppContent';
export default function AppShell() {
  const insets = useSafeAreaInsets();
  const bottomGap = Platform.OS === "android" ? Math.max(insets.bottom, 18) : 0;
  const finalBottomPadding = Platform.OS === 'web' ? 0 : bottomGap;

  return (
    <View style={styles.webRootWrapper}>
      <View style={[styles.appShell, { paddingBottom: finalBottomPadding }]}>
        <AppContent />
      </View>
    </View>
  );
}

