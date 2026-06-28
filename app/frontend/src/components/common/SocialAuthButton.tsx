/**
 * GreenGuard — SocialAuthButton Component
 * Circular bordered button for Google / Facebook sign-in
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  View,
  Text,
} from 'react-native';
import { Colors, Radius, Shadows } from '@/theme';

type SocialProvider = 'google' | 'facebook';

interface SocialAuthButtonProps {
  provider: SocialProvider;
  onPress: () => void;
  style?: ViewStyle;
}

export const SocialAuthButton = memo<SocialAuthButtonProps>(({
  provider,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.inner}>
        {provider === 'google' ? (
          // Google "G" colored text icon
          <View style={styles.gContainer}>
            <Text style={styles.gText}>
              <Text style={{ color: '#EA4335' }}>G</Text>
              <Text style={{ color: '#4285F4' }}>o</Text>
              <Text style={{ color: '#FBBC05' }}>o</Text>
              <Text style={{ color: '#4285F4' }}>g</Text>
              <Text style={{ color: '#34A853' }}>l</Text>
              <Text style={{ color: '#EA4335' }}>e</Text>
            </Text>
          </View>
        ) : (
          // Facebook "f"
          <Text style={styles.fText}>f</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

SocialAuthButton.displayName = 'SocialAuthButton';

const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: Radius.circle,
    borderWidth: 1.5,
    borderColor: Colors.borderMuted,
    backgroundColor: Colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gText: {
    fontSize: 18,
    fontWeight: '700',
  },
  fText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.facebookBlue,
  },
});
