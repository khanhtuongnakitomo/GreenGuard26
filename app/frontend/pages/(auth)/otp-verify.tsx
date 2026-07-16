/**
 * GreenGuard — OTP Verification Screen
 *
 * Step 2: Enter the 6-digit OTP with countdown + resend
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  withSequence,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { Button } from '@/components/common/Button';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/utils/mappers';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OtpVerifyScreen() {
  const { isLargeScreen } = useResponsive();
  const params = useLocalSearchParams<{ phone?: string; purpose?: string; otp?: string }>();
  const phone = params.phone ?? '';
  const purpose = (params.purpose as 'login' | 'register' | 'reset_password') || 'reset_password';
  const login = useAuthStore((s) => s.login);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [devHint, setDevHint] = useState(params.otp ?? '');
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Handle paste
      const chars = text.replace(/[^0-9]/g, '').split('').slice(0, OTP_LENGTH);
      const newOtp = [...otp];
      chars.forEach((c, i) => { if (index + i < OTP_LENGTH) newOtp[index + i] = c; });
      setOtp(newOtp);
      const nextIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[nextIdx]?.focus();
      return;
    }
    if (!/^\d*$/.test(text)) return;
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError('');
    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter all 6 digits');
      triggerShake();
      return;
    }
    if (!phone) {
      setError('Missing phone number');
      return;
    }

    setIsVerifying(true);
    setError('');
    try {
      if (purpose === 'reset_password') {
        router.push({
          pathname: '/(auth)/reset-password',
          params: { phone, otp: code },
        } as any);
        return;
      }

      const response = await authService.verifyOtp(phone, code);
      await login(
        response.accessToken,
        response.refreshToken,
        response.user._id,
        response.user,
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid OTP. Please try again.'));
      triggerShake();
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!phone) return;
    setCanResend(false);
    setCountdown(RESEND_SECONDS);
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    inputRefs.current[0]?.focus();
    try {
      const res = await authService.requestOtp(phone, purpose);
      if (res.devOtp) {
        setDevHint(res.devOtp);
        if (Platform.OS === 'web') {
          window.alert(`Dev OTP: ${res.devOtp}`);
        } else {
          Alert.alert('Dev OTP', res.devOtp);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to resend OTP'));
    }
  };

  const isComplete = otp.every((d) => d !== '');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration */}
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={styles.topBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerEmoji}>📱</Text>
          </View>
          <View style={styles.wave} />
        </LinearGradient>

        <View style={[styles.form, isLargeScreen && styles.formDesktop]}>
          <Text style={styles.title}>Verification Code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneText}>{phone || 'your phone'}</Text>
            {devHint ? `\n(Dev OTP: ${devHint})` : ''}
          </Text>

          {/* OTP boxes */}
          <Animated.View style={[styles.otpRow, shakeStyle]}>
            {Array(OTP_LENGTH).fill(null).map((_, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[
                  styles.otpBox,
                  otp[i] ? styles.otpBoxFilled : styles.otpBoxEmpty,
                  error ? styles.otpBoxError : undefined,
                ]}
                value={otp[i]}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                selectTextOnFocus
                caretHidden
              />
            ))}
          </Animated.View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Countdown + resend */}
          <View style={styles.resendRow}>
            {canResend ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendActive}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendInactive}>
                Resend in <Text style={styles.countdown}>{countdown}s</Text>
              </Text>
            )}
          </View>

          <Button
            label={isVerifying ? 'Verifying...' : 'Verify Code'}
            onPress={handleVerify}
            loading={isVerifying}
            disabled={!isComplete || isVerifying}
            style={styles.btn}
          />

          <Text style={styles.hint}>
            💡 For demo purposes, any code except <Text style={{ fontWeight: FontWeight.bold }}>000000</Text> works.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundWhite },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  contentDesktop: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundScreen, padding: Spacing['2xl'] },

  topBanner: { height: 240, position: 'relative', justifyContent: 'flex-end' },
  backBtn: { position: 'absolute', top: 20, left: Spacing.base, zIndex: 2, padding: Spacing.sm },
  bannerContent: { alignItems: 'center', paddingBottom: Spacing['3xl'] },
  bannerEmoji: { fontSize: 64 },
  wave: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 40, backgroundColor: Colors.backgroundWhite, borderTopLeftRadius: 32, borderTopRightRadius: 32 },

  form: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing['2xl'] },
  formDesktop: { width: 440, backgroundColor: Colors.backgroundWhite, borderRadius: 32, padding: Spacing['2xl'], ...Shadows.lg },

  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.primary, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  phoneText: { fontWeight: FontWeight.bold, color: Colors.textPrimary },

  otpRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center', marginBottom: Spacing.base },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 2,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  otpBoxEmpty: { borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.successLight },
  otpBoxError: { borderColor: Colors.error, backgroundColor: Colors.errorLight },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  errorText: { fontSize: FontSize.sm, color: Colors.error },

  resendRow: { alignItems: 'center', marginBottom: Spacing.base },
  resendActive: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semiBold },
  resendInactive: { fontSize: FontSize.base, color: Colors.textMuted },
  countdown: { fontWeight: FontWeight.bold, color: Colors.textPrimary },

  btn: { marginTop: Spacing.md, marginBottom: Spacing.base },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
