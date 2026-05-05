import React, { useEffect, useState } from 'react';
import { View, Text, Image, useWindowDimensions, Platform, StyleSheet } from 'react-native';
import { Asset } from 'expo-asset';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withDelay,
  withSequence,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles/globalStyles';

// Assets
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
  { img: FEATURE_ICONS[0], size: 110, x: '12%', y: '18%' }, // Moved further left
  { img: FEATURE_ICONS[1], size: 130, x: '70%', y: '20%' }, 
  { img: FEATURE_ICONS[2], size: 90, x: '16%', y: '65%' },  // Moved further left and down
  { img: FEATURE_ICONS[3], size: 100, x: '68%', y: '65%' }, 
  { img: PORTRAIT_ICONS[0], size: 80, x: '45%', y: '8%' },   // Moved further up
  { img: PORTRAIT_ICONS[1], size: 85, x: '75%', y: '42%' }, 
  { img: PORTRAIT_ICONS[2], size: 70, x: '8%', y: '42%' },   // Moved further left (Middle Left)
];

const FloatingCircle = ({ bubble, index, width, height }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

  // Calculate drift direction based on quadrant to avoid the center
  const isLeft = parseFloat(bubble.x) < 50;
  const isTop = parseFloat(bubble.y) < 45; 

  useEffect(() => {
    scale.value = withDelay(index * 200, withTiming(1, { 
      duration: 1000, 
      easing: Easing.out(Easing.back(1.5)) 
    }));
    opacity.value = withDelay(index * 200, withTiming(1, { duration: 800 }));

    // Drift AWAY from center slightly
    const rangeX = isLeft ? -15 : 15;
    const rangeY = isTop ? -15 : 15;

    driftX.value = withRepeat(
      withSequence(
        withTiming(rangeX, { duration: 3000 + index * 500 }),
        withTiming(0, { duration: 3000 + index * 500 })
      ),
      -1,
      true
    );
    driftY.value = withRepeat(
      withSequence(
        withTiming(rangeY, { duration: 2500 + index * 500 }),
        withTiming(0, { duration: 2500 + index * 500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: driftX.value },
      { translateY: driftY.value }
    ],
    opacity: opacity.value,
    top: bubble.y,
    left: bubble.x,
    width: bubble.size,
    height: bubble.size,
  }));

  return (
    <Animated.View style={[styles.introCircle, animatedStyle]}>
      <Image source={bubble.img} style={styles.introCircleImage} />
    </Animated.View>
  );
};

export default function WelcomeAnimation({ theme, onComplete }) {
  const { width, height } = useWindowDimensions();
  const [isReady, setIsReady] = useState(false);
  const brandingOpacity = useSharedValue(0);
  const brandingTranslateY = useSharedValue(30);
  const centralIconScale = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
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
        setIsReady(true);
      } catch (e) {
        console.warn("Asset preloading failed:", e);
        setIsReady(true);
      }
    }
    preloadAssets();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // Entrance animations
    centralIconScale.value = withTiming(1, { 
      duration: 1200, 
      easing: Easing.out(Easing.back(1.5)) 
    });
    
    brandingOpacity.value = withDelay(1200, withTiming(1, { duration: 1200 }));
    brandingTranslateY.value = withDelay(1200, withTiming(0, { duration: 1200, easing: Easing.out(Easing.back(1)) }));

    // Finish sequence after 5 seconds
    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 800 }, (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete, isReady]);

  const brandingStyle = useAnimatedStyle(() => ({
    opacity: brandingOpacity.value,
    transform: [{ translateY: brandingTranslateY.value }],
  }));

  const centralIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centralIconScale.value }],
  }));

  const rootStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  if (!isReady) {
    return (
      <View style={[styles.introRoot, { backgroundColor: '#07111f' }]}>
        <LinearGradient
          colors={[theme.accent, '#07111f']}
          style={styles.introGradient}
        >
          <View style={localStyles.centerContent}>
            <Animated.View style={[localStyles.centralIconWrapper, { transform: [{ scale: 1 }] }]}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={localStyles.centralIconImage}
              />
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.introRoot, rootStyle]}>
      <LinearGradient
        colors={[theme.accent, theme.background]}
        style={styles.introGradient}
      >
        {ALL_BUBBLES.map((bubble, i) => (
          <FloatingCircle 
            key={i} 
            bubble={bubble} 
            index={i} 
            width={width} 
            height={height} 
          />
        ))}

        <View style={localStyles.centerContent}>
          <Animated.View style={[localStyles.centralIconWrapper, centralIconStyle]}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={localStyles.centralIconImage}
            />
          </Animated.View>
        </View>

        <Animated.View style={[localStyles.bottomBranding, brandingStyle]}>
          <LinearGradient 
             colors={['#4F46E5', '#9333EA']}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 1 }}
             style={localStyles.logoWrapper}
           >
             <Image 
               source={require('../../assets/logo.png')} 
               style={localStyles.logoImage}
             />
           </LinearGradient>
            <View>
              <Text style={[localStyles.poweredBy, { color: theme.textSecondary }]}>Powered by</Text>
              <Text style={[localStyles.companyName, { color: theme.textPrimary }]}>CodroidHub</Text>
            </View>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60, // Move slightly upward for better visual centering
  },
  centralIconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28, 
    backgroundColor: 'rgba(255, 255, 255, 0.12)', // Subtle background plate to prevent color mixing
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // Thin border to define the rounded shape
  },
  centralIconImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    borderRadius: 20, // Rounded corners applied directly to the image
    opacity: 1, // Full opacity so it doesn't mix with the background color
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
  }
});
