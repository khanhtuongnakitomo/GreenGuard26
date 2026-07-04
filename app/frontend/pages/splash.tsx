/**
 * GreenGuard — Splash Screen
 *
 * Figma design:
 * - Full-screen dark forest photo background with dark green overlay
 * - Center: White pinwheel logo + "GREENGUARD" wordmark
 * - Below logo: "Welcome" in large white text
 * - Circuit board / dot pattern decorative overlay
 * - Bottom right: "Next →" circular button
 * - Auto-navigates to sign-in after 3 seconds OR on "Next" tap
 */
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ImageBackground,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors, FontSize, FontWeight, Spacing } from '@/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AUTO_NAVIGATE_DELAY = 3000;

export default function SplashScreen() {
  // Animation shared values
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(30);
  const welcomeOpacity = useSharedValue(0);
  const welcomeTranslateY = useSharedValue(20);
  const nextButtonOpacity = useSharedValue(0);

  useEffect(() => {
    // Staggered entrance animations
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    logoTranslateY.value = withDelay(300, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));

    welcomeOpacity.value = withDelay(800, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    welcomeTranslateY.value = withDelay(800, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));

    nextButtonOpacity.value = withDelay(1200, withTiming(1, { duration: 500 }));

    // Auto-navigate after delay
    const timer = setTimeout(() => {
      handleNext();
    }, AUTO_NAVIGATE_DELAY);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    router.replace('/(auth)/sign-in');
  };

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const welcomeAnimStyle = useAnimatedStyle(() => ({
    opacity: welcomeOpacity.value,
    transform: [{ translateY: welcomeTranslateY.value }],
  }));

  const nextButtonAnimStyle = useAnimatedStyle(() => ({
    opacity: nextButtonOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/BKI LOGO/background welcome.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Decorative dot pattern */}
        <View style={styles.dotsPattern}>
          {Array.from({ length: 80 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: Math.random() * 0.3 + 0.05,
                  left: `${(i % 10) * 10 + Math.random() * 5}%`,
                  top: `${Math.floor(i / 10) * 12 + Math.random() * 5}%`,
                },
              ]}
            />
          ))}
        </View>
      </ImageBackground>

      <SafeAreaView style={styles.safeArea}>
        {/* Center content */}
        <View style={styles.centerContent}>
          {/* Logo + wordmark */}
          <Animated.View style={[styles.logoContainer, logoAnimStyle]}>
            <Image 
              source={require('../assets/BKI LOGO/White On Dark.png')} 
              style={styles.splashLogo} 
              resizeMode="cover" 
            />
          </Animated.View>

          {/* Welcome text */}
          <Animated.View style={[styles.welcomeContainer, welcomeAnimStyle]}>
            <Text style={styles.welcomeText}>Welcome</Text>
          </Animated.View>
        </View>

        {/* Bottom: Next button */}
        <Animated.View style={[styles.bottomSection, nextButtonAnimStyle]}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextLabel}>Next</Text>
            <View style={styles.nextArrowCircle}>
              <Ionicons name="arrow-forward" size={18} color={Colors.textWhite} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSplash,
  },
  background: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0A1A0A',
  },
  overlayDark: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 30, 0, 0.85)',
  },
  overlayGreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 50, 10, 0.4)',
  },
  dotsPattern: {
    ...StyleSheet.absoluteFill,
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#4CAF50',
  },
  safeArea: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 140, // Move it up significantly
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  splashLogo: {
    width: 260,
    height: 70,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  welcomeText: {
    fontSize: 38,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    letterSpacing: 1,
  },
  bottomSection: {
    paddingBottom: Spacing['3xl'],
    paddingHorizontal: Spacing.screenHorizontal,
    alignItems: 'flex-end',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nextLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: Colors.textWhite,
  },
  nextArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.textWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
