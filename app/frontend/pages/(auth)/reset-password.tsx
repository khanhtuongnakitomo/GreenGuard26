/**
 * GreenGuard — Reset Password Screen
 *
 * Step 3: Enter and confirm new password with strength indicator
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
import { router, useLocalSearchParams } from 'expo-router';
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

// ─── Password strength ─────────────────────────────────────────────────────────

interface StrengthLevel {
  label: string;
  color: string;
  bars: number;
}

function getPasswordStrength(password: string, colors: any, t: any): StrengthLevel {
  if (!password) return { label: '', color: colors.borderMuted, bars: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: t('auth.weak', 'Weak'), color: colors.error, bars: 1 };
  if (score === 2) return { label: t('auth.fair', 'Fair'), color: colors.warning, bars: 2 };
  if (score === 3) return { label: t('auth.good', 'Good'), color: colors.info, bars: 3 };
  return { label: t('auth.strong', 'Strong'), color: colors.success, bars: 4 };
}

const PasswordStrengthBar = ({ password }: { password: string }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const strength = getPasswordStrength(password, colors, t);
  if (!password) return null;

  return (
    <View style={styles.strengthContainer}>
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map((bar) => (
          <View
            key={bar}
            style={[
              styles.strengthBar,
              { backgroundColor: bar <= strength.bars ? strength.color : colors.borderMuted },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
    </View>
  );
};

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormValues {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();

  const params = useLocalSearchParams<{ phone?: string; otp?: string }>();
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = async (values: FormValues) => {
    if (values.password !== values.confirmPassword) return;
    if (!params.phone || !params.otp) {
      Alert.alert(t('common.error', 'Error'), t('auth.missingVerification', 'Missing verification details. Please restart the reset flow.'));
      return;
    }
    setIsLoading(true);
    try {
      await authService.resetPassword(params.phone, params.otp, values.password);
      router.push('/(auth)/password-changed' as any);
    } catch (err) {
      const message = getApiErrorMessage(err, t('auth.resetFailed', 'Failed to reset password'));
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('common.error', 'Error'), message);
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
        <LinearGradient
          colors={[colors.primaryDark, '#1CA44D']} // fallback primary medium
          style={styles.topBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerEmoji}>🔑</Text>
          </View>
          <View style={[styles.wave, { backgroundColor: colors.backgroundWhite }]} />
        </LinearGradient>

        <View style={[styles.form, isLargeScreen && [styles.formDesktop, { backgroundColor: colors.backgroundWhite }]]}>
          <Text style={[styles.title, { color: colors.primary }]}>{t('auth.newPasswordTitle', 'New Password')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth.newPasswordSubtitle', 'Create a strong password for your account')}</Text>

          <Controller
            control={control}
            name="password"
            rules={{
              required: 'Password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            }}
            render={({ field: { onChange, value, onBlur } }) => (
              <>
                <TextInput
                  label={t('auth.newPasswordLabel', 'New Password')}
                  placeholder={t('auth.newPasswordPlaceholder', 'Enter new password')}
                  showPasswordToggle
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
                <PasswordStrengthBar password={value} />
              </>
            )}
          />

          {/* Tips */}
          <View style={[styles.tipBox, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Text style={[styles.tipTitle, { color: colors.textSecondary }]}>{t('auth.passwordTips', 'Password Tips')}</Text>
            {[
              [t('auth.tipLength', 'At least 8 characters'), password.length >= 8],
              [t('auth.tipUpper', 'One uppercase letter (A–Z)'), /[A-Z]/.test(password)],
              [t('auth.tipNumber', 'One number (0–9)'), /[0-9]/.test(password)],
              [t('auth.tipSpecial', 'One special character'), /[^A-Za-z0-9]/.test(password)],
            ].map(([tip, met]) => (
              <View key={String(tip)} style={styles.tipRow}>
                <Ionicons
                  name={met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={met ? colors.success : colors.borderMuted}
                />
                <Text style={[styles.tipText, { color: colors.textMuted }, met && { color: colors.success }]}>{String(tip)}</Text>
              </View>
            ))}
          </View>

          <Controller
            control={control}
            name="confirmPassword"
            rules={{
              required: 'Please confirm your password',
              validate: (val) => val === password || 'Passwords do not match',
            }}
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('auth.confirmPassword', 'Confirm Password')}
                placeholder={t('auth.confirmPasswordPlaceholder', 'Re-enter your password')}
                showPasswordToggle
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Button
            label={isLoading ? t('auth.saving', 'Saving...') : t('auth.setNewPassword', 'Set New Password')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.btn}
            leftIcon={!isLoading ? <Ionicons name="lock-closed" size={18} color={colors.textWhite} /> : undefined}
          />
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

  topBanner: { height: 240, position: 'relative', justifyContent: 'flex-end' },
  backBtn: { position: 'absolute', top: 20, left: Spacing.base, zIndex: 2, padding: Spacing.sm },
  bannerContent: { alignItems: 'center', paddingBottom: Spacing['3xl'] },
  bannerEmoji: { fontSize: 64 },
  wave: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 40, borderTopLeftRadius: 32, borderTopRightRadius: 32 },

  form: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing['2xl'] },
  formDesktop: { width: 440, borderRadius: 32, padding: Spacing['2xl'], ...Shadows.lg },

  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.base, lineHeight: 22, marginBottom: Spacing.xl },

  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, minWidth: 46 },

  tipBox: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
  },
  tipTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, marginBottom: Spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  tipText: { fontSize: FontSize.sm },

  btn: { marginTop: Spacing.base },
});
