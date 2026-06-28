/**
 * GreenGuard — ScanQRBanner Component (Home Screen)
 *
 * Figma: Dark green full-width banner with QR icon + text + right arrow
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
        <Ionicons name="qr-code-outline" size={28} color={Colors.textWhite} />
      </View>

      {/* Text content */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>Scan QR</Text>
        <Text style={styles.subtitle}>to claim points</Text>
      </View>

      {/* Right arrow in circle */}
      <View style={styles.arrowCircle}>
        <Ionicons name="chevron-forward" size={20} color={Colors.textWhite} />
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
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.card,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
