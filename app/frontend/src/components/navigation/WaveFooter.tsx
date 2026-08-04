import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/theme';

const WAVE_HEIGHT = 70;

interface WaveFooterProps {
  style?: ViewStyle;
}

export const WaveFooter = memo<WaveFooterProps>(({ style }) => {
  // SVG path for a bottom organic wave
  const wavePath = `
    M 0 ${WAVE_HEIGHT}
    L 1000 ${WAVE_HEIGHT}
    L 1000 30
    Q 750 -10 500 30
    Q 250 60 0 20
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
    </View>
  );
});

WaveFooter.displayName = 'WaveFooter';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    marginTop: -20, // To pull it slightly closer to content if needed
  },
});
