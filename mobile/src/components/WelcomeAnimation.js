import React, { useEffect, useState } from 'react';
import { View, Text, Image, useWindowDimensions, Platform, StyleSheet } from 'react-native';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles/globalStyles';

const FEATURE_ICONS = [
  require('../../assets/selfie_feature_icon.png'),
  require('../../assets/story_feature_icon.png'),
  require('../../assets/emoji_feature_icon.png'),
  require('../../assets/room_feature_icon.png'),
];

const PORTRAIT_ICONS = [
  require('../../assets/avatar1.png'),
  require('../../assets/avatar2.png'),
  require('../../assets/avatar3.png'),
];

const ALL_BUBBLES = [
  { img: FEATURE_ICONS[0], size: 110, x: '12%', y: '18%' },
  { img: FEATURE_ICONS[1], size: 130, x: '70%', y: '20%' },
  { img: FEATURE_ICONS[2], size: 90, x: '16%', y: '65%' },
  { img: FEATURE_ICONS[3], size: 100, x: '68%', y: '65%' },
  { img: PORTRAIT_ICONS[0], size: 80, x: '45%', y: '8%' },
  { img: PORTRAIT_ICONS[1], size: 85, x: '75%', y: '42%' },
  { img: PORTRAIT_ICONS[2], size: 70, x: '8%', y: '42%' },
];

export default function WelcomeAnimation({ theme, onComplete }) {
  const { width, height } = useWindowDimensions();
  const [isReady, setIsReady] = useState(false);
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    async function preloadAssets() {
      try {
        const images = [
          require('../../assets/selfie_feature_icon.png'),
          require('../../assets/story_feature_icon.png'),
          require('../../assets/emoji_feature_icon.png'),
          require('../../assets/room_feature_icon.png'),
          require('../../assets/avatar1.png'),
          require('../../assets/avatar2.png'),
          require('../../assets/avatar3.png'),
          require('../../assets/icon.png'),
          require('../../assets/logo.png'),
        ];
        await Asset.loadAsync(images);
        if (!cancelled) setIsReady(true);
      } catch (e) {
        if (!cancelled) setIsReady(true);
      }
    }
    preloadAssets();
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, 4000);
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    setPhase('entering');
    const t1 = setTimeout(() => setPhase('branding'), 1400);
    const t2 = setTimeout(() => setPhase('outro'), 5000);
    const t3 = setTimeout(() => onComplete(), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isReady, onComplete]);

  const showContent = phase !== 'loading';

  if (!showContent) {
    return (
      <View style={[styles.introRoot, { backgroundColor: '#07111f' }]}>
        <LinearGradient colors={[theme.accent, '#07111f']} style={styles.introGradient}>
          <View style={localStyles.centerContent}>
            <Image source={require('../../assets/icon.png')} style={localStyles.centralIconImage} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.introRoot, { backgroundColor: '#07111f' }]}>
      <LinearGradient colors={[theme.accent, theme.background]} style={styles.introGradient}>
        {ALL_BUBBLES.map((bubble, i) => (
          <View key={i} style={[localStyles.bubble, { top: bubble.y, left: bubble.x, width: bubble.size, height: bubble.size }]}>
            <Image source={bubble.img} style={{ width: '100%', height: '100%' }} />
          </View>
        ))}
        <View style={localStyles.centerContent}>
          <View style={localStyles.centralIconWrapper}>
            <Image source={require('../../assets/icon.png')} style={localStyles.centralIconImage} />
          </View>
        </View>
        {phase === 'branding' || phase === 'outro' ? (
          <View style={localStyles.bottomBranding}>
            <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={localStyles.logoWrapper}>
              <Image source={require('../../assets/logo.png')} style={localStyles.logoImage} />
            </LinearGradient>
            <View>
              <Text style={[localStyles.poweredBy, { color: theme.textSecondary }]}>Powered by</Text>
              <Text style={[localStyles.companyName, { color: theme.textPrimary }]}>CodroidHub</Text>
            </View>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const localStyles = StyleSheet.create({
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  centralIconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  centralIconImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    borderRadius: 20,
    opacity: 1,
  },
  bottomBranding: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 60 : 85,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 12,
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  poweredBy: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: -2,
  },
  companyName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bubble: {
    position: 'absolute',
    borderRadius: 1000,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
