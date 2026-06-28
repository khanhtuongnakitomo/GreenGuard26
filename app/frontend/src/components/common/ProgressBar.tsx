/**
 * GreenGuard — ProgressBar Component
 * Animated filled track bar.
 */
import React, { memo, useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Radius } from '@/theme';

interface ProgressBarProps {
  progress: number;        // 0-100
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
  animated?: boolean;
}

export const ProgressBar = memo<ProgressBarProps>(({
  progress,
  color = Colors.primary,
  trackColor = Colors.accentSoft,
  height = 8,
  style,
  animated = true,
}) => {
  const width = useSharedValue(0);

  useEffect(() => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    if (animated) {
      width.value = withTiming(clampedProgress, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      width.value = clampedProgress;
    }
  }, [progress, animated, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, height, borderRadius: height / 2 },
          animatedStyle,
        ]}
      />
    </View>
  );
});

ProgressBar.displayName = 'ProgressBar';

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
