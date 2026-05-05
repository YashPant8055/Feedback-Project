import { Alert, Platform } from 'react-native';

/**
 * A cross-platform alert helper that uses window.alert on web
 * and Alert.alert on native platforms.
 */
export const showAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    const fullMessage = title ? `${title}: ${message}` : message;
    
    // Using setTimeout on web to allow React state updates (like clearing loading indicators) 
    // to finish and paint before the blocking window.alert shows up.
    setTimeout(() => {
      // For simple alerts with only one button (or no buttons)
      if (buttons.length <= 1) {
        window.alert(fullMessage);
        if (buttons[0] && buttons[0].onPress) {
          buttons[0].onPress();
        }
      } else {
        // For alerts with multiple buttons, use confirm for the first two
        // This is a basic fallback for web
        const result = window.confirm(`${fullMessage}\n\n${buttons.map(b => b.text).join(' / ')}`);
        if (result) {
          // If "OK" (true), run the first non-cancel button or the first button
          const confirmButton = buttons.find(b => b.style === 'destructive') || buttons.find(b => b.style !== 'cancel') || buttons[0];
          if (confirmButton && confirmButton.onPress) confirmButton.onPress();
        } else {
          // If "Cancel" (false), run the cancel button
          const cancelButton = buttons.find(b => b.style === 'cancel');
          if (cancelButton && cancelButton.onPress) cancelButton.onPress();
        }
      }
    }, 10);
  } else {
    // Ensure there is always at least an OK button to avoid locking the UI on Android
    const finalButtons = buttons.length > 0 ? buttons : [{ text: 'OK' }];
    Alert.alert(title, message, finalButtons);
  }
};
