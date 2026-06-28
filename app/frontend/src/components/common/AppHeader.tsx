/**
 * GreenGuard — AppHeader Component
 *
 * Used on all authenticated screens.
 * Left: GreenGuard pinwheel logo + wordmark
 * Right: notification bell (default) or settings gear (Profile screen)
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '@/theme';

import { router } from 'expo-router';

type RightIconType = 'bell' | 'settings' | 'none';

interface AppHeaderProps {
  rightIcon?: RightIconType;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  hideLogo?: boolean;
  showBack?: boolean;
}

export const AppHeader = memo<AppHeaderProps>(({
  rightIcon = 'bell',
  onRightIconPress,
  style,
  hideLogo = false,
  showBack = false,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Left: Logo or Back Button */}
      <View style={styles.logoContainer}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : !hideLogo ? (
          <Image 
            source={require('../../../assets/BKI LOGO/Horiziontal.png')} 
            style={styles.headerLogo} 
            resizeMode="cover" 
          />
        ) : null}
      </View>

      {/* Right: Action icon */}
      {rightIcon !== 'none' && (
        <TouchableOpacity
          onPress={onRightIconPress}
          style={styles.iconButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={rightIcon === 'bell' ? 'notifications-outline' : 'settings-outline'}
            size={24}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

AppHeader.displayName = 'AppHeader';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundWhite,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerLogo: {
    width: 220,
    height: 55,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  backText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
});
