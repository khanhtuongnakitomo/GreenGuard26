/**
 * GreenGuard — LoadingSpinner Component
 */
import React, { memo } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { Colors, FontSize } from '@/theme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = memo<LoadingSpinnerProps>(({
  size = 'large',
  color = Colors.primary,
  message,
  fullScreen = false,
}) => {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  message: {
    marginTop: 12,
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
