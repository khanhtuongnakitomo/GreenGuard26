/**
 * GreenGuard — ScanQRBanner Component (Home Screen)
 *
 * Premium: scale press feedback, micro-animation on the QR icon box,
 * improved typography, richer arrow circle.
 */
import React, { memo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/theme';

interface ScanQRBannerProps {
  style?: ViewStyle;
}

export const ScanQRBanner = memo<ScanQRBannerProps>(({ style }) => {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  // Subtle QR icon pulse
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    iconPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1,
      true,
    );
  }, []);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 350 });
    pressed.value = withTiming(1, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 350 });
    pressed.value = withTiming(0, { duration: 150 });
    router.push('/qr-scan');
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.92]),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, style, cardStyle]}
      // @ts-ignore
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePressIn}
      onResponderRelease={handlePressOut}
      onResponderTerminate={() => {
        scale.value = withSpring(1);
        pressed.value = withTiming(0, { duration: 150 });
      }}
    >
      {/* QR icon */}
      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <Ionicons name="qr-code-outline" size={26} color={Colors.textWhite} />
      </Animated.View>

      {/* Text content */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>Scan QR Code</Text>
        <Text style={styles.subtitle}>Tap to claim your green points</Text>
      </View>

      {/* Right arrow circle */}
      <View style={styles.arrowCircle}>
        <Ionicons name="chevron-forward" size={18} color={Colors.textWhite} />
      </View>
    </Animated.View>
  );
});

ScanQRBanner.displayName = 'ScanQRBanner';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.32,
        shadowRadius: 12,
      },
      android: { elevation: 7 },
    }),
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    letterSpacing: 0.1,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.1,
  },
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
