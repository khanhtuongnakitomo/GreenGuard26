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
import { Spacing, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';

type RightIconType = 'bell' | 'settings' | 'none';

interface AppHeaderProps {
  rightIcon?: RightIconType;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  hideLogo?: boolean;
  showBack?: boolean;
  /** Show a user avatar initials circle next to the icon */
  avatarInitials?: string;
}

export const AppHeader = memo<AppHeaderProps>((
  {
    rightIcon = 'bell',
    onRightIconPress,
    style,
    hideLogo = false,
    showBack = false,
    avatarInitials,
  }) => {
  const { colors, colorScheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundScreen }, style]}>
      {/* Left: Logo or Back Button */}
      <View style={styles.logoContainer}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            <Text style={[styles.backText, { color: colors.textPrimary }]}>Back</Text>
          </TouchableOpacity>
        ) : !hideLogo ? (
          <Image
            source={colorScheme === 'dark' ? require('../../../assets/BKI LOGO/White On Dark Horiziontal.png') : require('../../../assets/BKI LOGO/Horiziontal.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        ) : null}
      </View>

      {/* Right: action area */}
      <View style={styles.rightArea}>
        {avatarInitials ? (
          <View style={[styles.avatarCircle, { backgroundColor: colors.greenLight, borderColor: colors.cardBorder }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {avatarInitials.charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : null}
        {rightIcon !== 'none' && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={rightIcon === 'bell' ? 'notifications-outline' : 'settings-outline'}
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        )}
      </View>
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
    paddingVertical: Spacing.sm,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerLogo: {
    width: 180,
    height: 70,
    marginLeft: -10,
    transform: [{ scale: 1.6 }],
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  backText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});
