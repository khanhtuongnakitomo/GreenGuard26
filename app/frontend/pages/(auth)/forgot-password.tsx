/**
 * GreenGuard — Forgot Password Screen
 *
 * Step 1: Enter phone number to receive OTP
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { TextInput } from '@/components/common/TextInput';
import { Button } from '@/components/common/Button';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/services/auth.service';
import { getApiErrorMessage } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

interface FormValues { phone: string }

export default function ForgotPasswordScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { phone: '' },
  });

  const onSubmit = async ({ phone }: FormValues) => {
    setIsLoading(true);
    try {
      const res = await authService.requestOtp(phone, 'reset_password');
      router.push({
        pathname: '/(auth)/otp-verify',
        params: { phone, purpose: 'reset_password', otp: res.devOtp ?? '' },
      } as any);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to send OTP');
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundWhite }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && [styles.contentDesktop, { backgroundColor: colors.backgroundScreen }]]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header illustration */}
        <LinearGradient
          colors={[colors.primaryDark, colors.primary, '#1CA44D']} // Note: Keeping a hardcoded variant for the third since it's a gradient point, or fallback to primary
          style={styles.illustrationBox}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.illustrationContent}>
            <View style={styles.illustrationCircle}>
              <Text style={styles.illustrationEmoji}>🔐</Text>
            </View>
          </View>
          <View style={[styles.wave, { backgroundColor: colors.backgroundWhite }]} />
        </LinearGradient>

        {/* Form */}
        <View style={[styles.form, isLargeScreen && [styles.formDesktop, { backgroundColor: colors.backgroundWhite }]]}>
          <Text style={[styles.title, { color: colors.primary }]}>{t('auth.forgotPasswordTitle', 'Forgot Password?')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('auth.forgotPasswordSubtitle', "Don't worry! Enter your phone number and we'll send you a verification code.")}
          </Text>

          <Controller
            control={control}
            name="phone"
            rules={{ required: 'Phone number is required', minLength: { value: 9, message: 'Invalid phone number' } }}
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('auth.phoneNumber', 'Phone Number')}
                placeholder={t('auth.phoneNumberPlaceholderForgot', 'e.g. 0912 345 678')}
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phone?.message}
              />
            )}
          />

          <Button
            label={t('auth.sendVerificationCode', 'Send Verification Code')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.btn}
            leftIcon={!isLoading ? <Ionicons name="send-outline" size={18} color={colors.textWhite} /> : undefined}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('auth.rememberPassword', 'Remember your password? ')}</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>{t('auth.signIn', 'Sign In')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  contentDesktop: { justifyContent: 'center', alignItems: 'center', padding: Spacing['2xl'] },

  illustrationBox: { height: 260, position: 'relative', justifyContent: 'flex-end' },
  backBtn: { position: 'absolute', top: 20, left: Spacing.base, zIndex: 2, padding: Spacing.sm },
  illustrationContent: { alignItems: 'center', paddingBottom: Spacing['2xl'], zIndex: 1 },
  illustrationCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: { fontSize: 52 },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 40,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },

  form: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing['2xl'] },
  formDesktop: { width: 440, borderRadius: 32, padding: Spacing['2xl'], ...Shadows.lg },

  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.base, lineHeight: 22, marginBottom: Spacing.xl },

  btn: { marginTop: Spacing.xl, marginBottom: Spacing.xl },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: FontSize.sm },
  footerLink: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
});
