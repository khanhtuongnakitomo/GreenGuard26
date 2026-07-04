/**
 * GreenGuard — ScanQRBanner Component (Home Screen)
 *
 * Figma: Dark green full-width banner with QR icon + "Scan QR / to claim points" + right arrow circle
 * Tappable → navigates to QR scanner modal
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';

interface ScanQRBannerProps {
  style?: ViewStyle;
}

export const ScanQRBanner = memo<ScanQRBannerProps>(({ style }) => {
  const handlePress = () => {
    router.push('/qr-scan');
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* QR icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="qr-code-outline" size={26} color={Colors.textWhite} />
      </View>

      {/* Text content */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>Scan QR</Text>
        <Text style={styles.subtitle}>to claim points</Text>
      </View>

      {/* Right arrow in circle */}
      <View style={styles.arrowCircle}>
        <Ionicons name="chevron-forward" size={18} color={Colors.textWhite} />
      </View>
    </TouchableOpacity>
  );
});

ScanQRBanner.displayName = 'ScanQRBanner';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    ...Shadows.button,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 1,
    fontWeight: FontWeight.medium,
  },
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
