import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, BackHandler, Platform, StyleSheet, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles/globalStyles';
import { FEEDBACK_CONFIG, ANIMATION_SCREENS } from '../constants/emotions';

export default function FeedbackAnimationScreen({ review, onDone, theme }) {
  const insets = useSafeAreaInsets();
  const config = ANIMATION_SCREENS[review] || ANIMATION_SCREENS.average;
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    // Show particles immediately on mount
    const timer = setTimeout(() => setShowParticles(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onDone();
        return true;
      }
    );

    return () => subscription.remove();
  }, [onDone]);

  return (
    <View style={[styles.animScreenRoot, { backgroundColor: theme.background }]}>
      <View pointerEvents="none" style={styles.animBackdrop}>
        <View
          style={[
            styles.animGlowTop,
            { backgroundColor: config.gradient[0] },
          ]}
        />
        <View
          style={[
            styles.animGlowBottom,
            { backgroundColor: config.gradient[1] },
          ]}
        />
      </View>

      <View
        style={[
          styles.animContent,
          { paddingTop: Math.max(insets.top, 40), paddingBottom: Math.max(insets.bottom, 40) },
        ]}
      >
        {showParticles && (
          <View pointerEvents="none" style={styles.animParticleWrap}>
            {config.particleEmojis.map((p, i) => (
              <Text
                key={i}
                style={[
                  styles.animParticle,
                  {
                    top: `${15 + i * 16}%`,
                    left: `${10 + ((i * 23) % 70)}%`,
                    opacity: 0.5 + (i % 3) * 0.2,
                    fontSize: 24 + (i % 3) * 8,
                  },
                ]}
              >
                {p}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.animEmojiWrap}>
          <View
            style={[
              styles.animEmojiGlow,
              { backgroundColor: config.gradient[0] },
            ]}
          />
          <Text style={styles.animEmojiText}>{config.emoji}</Text>
        </View>

        <Text style={[styles.animTitle, { color: config.accentColor }]}>
          {config.title}
        </Text>
        <Text style={[styles.animSubtitle, { color: theme.textMuted }]}>
          {config.subtitle}
        </Text>

        <View
          style={[
            styles.animFeedbackBadge,
            { backgroundColor: config.gradient[0] },
          ]}
        >
          <Text
            style={[
              styles.animFeedbackValue,
              { color: config.accentColor, fontSize: 16 },
            ]}
          >
            Thanks for your feedback!
          </Text>
        </View>

        <Pressable
          style={[styles.animDoneButton, { backgroundColor: config.accentColor }]}
          onPress={onDone}
        >
          <Text style={[styles.animDoneButtonText, { color: theme.background }]}>
            Back
          </Text>
        </Pressable>
      </View>

      <StatusBar hidden />
    </View>
  );
}
