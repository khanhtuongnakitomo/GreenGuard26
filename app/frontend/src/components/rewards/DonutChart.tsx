/**
 * GreenGuard — DonutChart Component (Rewards Screen)
 *
 * Figma: SVG donut chart with multiple green shades
 * Center: "15Kg" large text
 * Legend: percentages around the outside
 */
import React, { memo, useEffect } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedProps,
  Easing,
} from 'react-native-reanimated';
import { FontSize, FontWeight } from '@/theme';
import { WasteBreakdown } from '@/types/reward.types';
import { useTheme } from '@/hooks/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DonutChartProps {
  totalKg: number;
  breakdown: WasteBreakdown[];
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
}

export const DonutChart = memo<DonutChartProps>(({
  totalKg,
  breakdown,
  size = 180,
  strokeWidth = 28,
  style,
}) => {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const animProgress = useSharedValue(0);

  useEffect(() => {
    animProgress.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [animProgress]);

  let cumulativeOffset = 0;

  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${center} ${center})`}>
          {breakdown.map((segment, index) => {
            const segmentLength = (segment.percentage / 100) * circumference;
            const dashOffset = circumference - segmentLength;
            const strokeDashoffset = cumulativeOffset;

            // Store cumulative offset for next segment
            const currentOffset = cumulativeOffset;
            cumulativeOffset += segmentLength;

            return (
              <Circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>

      {/* Center label */}
      <View style={[styles.centerLabel, { width: size, height: size }]}>
        <Text style={[styles.kgValue, { color: colors.textPrimary }]}>{totalKg}</Text>
        <Text style={[styles.kgUnit, { color: colors.textMuted }]}>Kg</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {breakdown.map((segment) => (
          <View key={segment.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text style={[styles.legendPercent, { color: colors.textPrimary }]}>{segment.percentage}%</Text>
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{segment.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

DonutChart.displayName = 'DonutChart';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kgValue: {
    fontSize: FontSize['5xl'],
    fontWeight: FontWeight.bold,
    lineHeight: 36,
    letterSpacing: -1,
  },
  kgUnit: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semiBold,
  },
  legend: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendPercent: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
  },
  legendLabel: {
    fontSize: FontSize.xs,
  },
});
