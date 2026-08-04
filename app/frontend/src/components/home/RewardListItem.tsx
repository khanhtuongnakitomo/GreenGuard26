/**
 * GreenGuard — RewardListItem Component (Home Screen Rewards section)
 *
 * Premium card: scale press animation, layered shadow, refined brand circle,
 * better icon-text spacing, points badge pill styling.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Spacing, FontSize, FontWeight, Radius } from '@/theme';
import { Reward } from '@/types/reward.types';
import { useTheme } from '@/hooks/useTheme';

interface RewardListItemProps {
  reward: Reward;
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export const RewardListItem = memo<RewardListItemProps>(({ reward, onPress, style }) => {
  const { colors } = useTheme();

  const brandInitial = reward.brandName.charAt(0).toUpperCase();
  const brandColor = reward.brandColor ?? colors.primary;

  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 350 });
    pressed.value = withTiming(1, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 350 });
    pressed.value = withTiming(0, { duration: 150 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.9]),
  }));

  return (
    <Animated.View
      style={[styles.wrapper, animatedStyle]}
    >
      <Animated.View
        // @ts-ignore – onStartShouldSetResponder used for press on Animated.View
        onStartShouldSetResponder={() => true}
        onResponderGrant={handlePressIn}
        onResponderRelease={() => { handlePressOut(); onPress?.(); }}
        onResponderTerminate={handlePressOut}
        style={[
          styles.container,
          { backgroundColor: `${brandColor}10` },
          style,
        ]}
      >
        {/* Brand logo circle */}
        <View style={[styles.brandCircle, { backgroundColor: brandColor }]}>
          <Text style={styles.brandInitial}>{brandInitial}</Text>
        </View>

        {/* Reward info */}
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {reward.title}
        </Text>

        {/* Right: points pill or gift icon */}
        <View style={styles.rightSection}>
          {reward.pointsValue ? (
            <View style={[styles.pointsPill, { borderColor: `${brandColor}33`, backgroundColor: `${brandColor}14` }]}>
              <Text style={[styles.pointsValue, { color: brandColor }]}>
                {reward.pointsValue >= 1000
                  ? `${(reward.pointsValue / 1000).toFixed(reward.pointsValue % 1000 === 0 ? 0 : 1)}k`
                  : String(reward.pointsValue)}
              </Text>
            </View>
          ) : (
            <View style={[styles.giftBox, { backgroundColor: `${brandColor}18` }]}>
              <Ionicons name="gift-outline" size={16} color={brandColor} />
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
});

RewardListItem.displayName = 'RewardListItem';

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 3,
    gap: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.055)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  brandCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandInitial: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  title: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    lineHeight: 20,
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  pointsValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.2,
  },
  giftBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
