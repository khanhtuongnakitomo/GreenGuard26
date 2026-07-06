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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import { TextInput } from '@/components/common/TextInput';
import { Button } from '@/components/common/Button';
import { useResponsive } from '@/hooks/useResponsive';

// ─── Password strength ─────────────────────────────────────────────────────────

interface StrengthLevel {
  label: string;
  color: string;
  bars: number;
}

function getPasswordStrength(password: string): StrengthLevel {
  if (!password) return { label: '', color: Colors.borderMuted, bars: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', color: Colors.error, bars: 1 };
  if (score === 2) return { label: 'Fair', color: Colors.warning, bars: 2 };
  if (score === 3) return { label: 'Good', color: Colors.info, bars: 3 };
  return { label: 'Strong', color: Colors.success, bars: 4 };
}

const PasswordStrengthBar = ({ password }: { password: string }) => {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <View style={styles.strengthContainer}>
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map((bar) => (
          <View
            key={bar}
            style={[
              styles.strengthBar,
              { backgroundColor: bar <= strength.bars ? strength.color : Colors.borderMuted },
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
  const params = useLocalSearchParams<{ phone?: string }>();
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setIsLoading(false);
    router.push('/(auth)/password-changed');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primaryMedium]}
          style={styles.topBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerEmoji}>🔑</Text>
          </View>
          <View style={styles.wave} />
        </LinearGradient>

        <View style={[styles.form, isLargeScreen && styles.formDesktop]}>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>Create a strong password for your account</Text>

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
                  label="New Password"
                  placeholder="Enter new password"
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
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Password Tips</Text>
            {[
              ['At least 8 characters', password.length >= 8],
              ['One uppercase letter (A–Z)', /[A-Z]/.test(password)],
              ['One number (0–9)', /[0-9]/.test(password)],
              ['One special character', /[^A-Za-z0-9]/.test(password)],
            ].map(([tip, met]) => (
              <View key={String(tip)} style={styles.tipRow}>
                <Ionicons
                  name={met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={met ? Colors.success : Colors.borderMuted}
                />
                <Text style={[styles.tipText, met && styles.tipTextMet]}>{String(tip)}</Text>
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
                label="Confirm Password"
                placeholder="Re-enter your password"
                showPasswordToggle
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Button
            label={isLoading ? 'Saving...' : 'Set New Password'}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.btn}
            leftIcon={!isLoading ? <Ionicons name="lock-closed" size={18} color={Colors.textWhite} /> : undefined}
          />
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

  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, minWidth: 46 },

  tipBox: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  tipText: { fontSize: FontSize.sm, color: Colors.textMuted },
  tipTextMet: { color: Colors.success },

  btn: { marginTop: Spacing.base },
});
