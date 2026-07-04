/**
 * GreenGuard — WaveHeader Component
 *
 * The curved dark green wave shape at the top of auth screens.
 * Contains the GreenGuard logo + wordmark.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, FontSize, FontWeight, Spacing } from '@/theme';

const WAVE_HEIGHT = 140;

interface WaveHeaderProps {
  style?: ViewStyle;
}

export const WaveHeader = memo<WaveHeaderProps>(({ style }) => {
  // SVG path for the organic wave bottom edge
  const wavePath = `
    M 0 0
    L 1000 0
    L 1000 ${WAVE_HEIGHT - 60}
    Q 750 ${WAVE_HEIGHT + 20} 500 ${WAVE_HEIGHT - 20}
    Q 250 ${WAVE_HEIGHT - 60} 0 ${WAVE_HEIGHT - 30}
    Z
  `;

  return (
    <View style={[styles.container, { height: WAVE_HEIGHT }, style]}>
      <Svg
        width="100%"
        height={WAVE_HEIGHT}
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 1000 ${WAVE_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Path d={wavePath} fill={Colors.primaryDark} />
      </Svg>



      {/* Small leaf icon bottom right */}
      <View style={styles.leafCorner}>
        <Text style={styles.leafEmoji}>🍃</Text>
      </View>
    </View>
  );
});

WaveHeader.displayName = 'WaveHeader';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'visible',
  },

  leafCorner: {
    position: 'absolute',
    bottom: 20,
    right: Spacing.xl,
    opacity: 0.6,
  },
  leafEmoji: {
    fontSize: 24,
  },
});
