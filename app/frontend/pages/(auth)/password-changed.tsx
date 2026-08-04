/**
 * GreenGuard — Password Changed Successfully Screen
 *
 * Step 4: Success animation + back to sign in
 */
import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { Button } from '@/components/common/Button';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

export default function PasswordChangedScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();

  const circleScale = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    // Sequence: circle springs in → icon appears → text fades in → button fades in
    circleScale.value = withSpring(1, { damping: 8, stiffness: 120 });
    iconScale.value = withDelay(300, withSpring(1, { damping: 6 }));
    textOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    textTranslateY.value = withDelay(600, withSpring(0, { damping: 12 }));
    btnOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
  }, []);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: circleScale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value }));

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary, '#1CA44D']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={styles.decor1} />
        <View style={styles.decor2} />
        <View style={styles.decor3} />

        <View style={styles.content}>
          {/* Success animation */}
          <Animated.View style={[styles.outerCircle, circleStyle]}>
            <View style={[styles.innerCircle, { backgroundColor: colors.backgroundWhite }]}>
              <Animated.View style={iconStyle}>
                <Text style={styles.checkEmoji}>✅</Text>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Text */}
          <Animated.View style={[styles.textBlock, textStyle]}>
            <Text style={[styles.title, { color: colors.textWhite }]}>{t('auth.passwordChangedTitle', 'Password Changed!')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.passwordChangedDesc1', 'Your password has been successfully updated.')}{'\n'}
              {t('auth.passwordChangedDesc2', 'You can now sign in with your new password.')}
            </Text>
          </Animated.View>

          {/* Button */}
          <Animated.View style={[styles.btnWrapper, btnStyle]}>
            <Button
              label={t('auth.backToSignIn', 'Back to Sign In')}
              onPress={() => router.replace('/(auth)/sign-in')}
              style={{ backgroundColor: colors.backgroundWhite }}
              textStyle={{ color: colors.primary }}
            />
          </Animated.View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  gradient: { flex: 1 },

  // Decorative
  decor1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, left: -80 },
  decor2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', bottom: 100, right: -40 },
  decor3: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.03)', top: 200, right: 40 },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['2xl'] },

  outerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  innerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xl,
  },
  checkEmoji: { fontSize: 60 },

  textBlock: { alignItems: 'center', marginBottom: Spacing['2xl'] },
  title: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },

  btnWrapper: { width: '100%' },
});
