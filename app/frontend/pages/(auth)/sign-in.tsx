/**
 * GreenGuard — Sign In Screen
 *
 * Figma design:
 * - Dark green wave at top with logo
 * - Title: "Sign in to your account"
 * - Email + Password inputs
 * - "Forgot password?" right-aligned
 * - Terms checkbox
 * - Dark green Sign In button (pill)
 * - "other way to sign in" + Google/Facebook buttons
 * - "Don't have an account? Create Account" footer
 * - Small white leaf icon bottom right
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
  Linking,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WaveHeader } from '@/components/navigation/WaveHeader';
import { WaveFooter } from '@/components/navigation/WaveFooter';
import { TextInput } from '@/components/common/TextInput';
import { Button } from '@/components/common/Button';
import { Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { signInSchema, SignInFormValues } from '@/utils/validators';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { useResponsive } from '@/hooks/useResponsive';
import { getApiErrorMessage } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

export default function SignInScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors, colorScheme } = useTheme();
  const { t } = useI18n();

  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: yupResolver(signInSchema),
    defaultValues: {
      phoneNumber: '',
      password: '',
      agreedToTerms: false,
    },
  });

  const agreedToTerms = watch('agreedToTerms');

  const onSubmit = async (values: SignInFormValues) => {
    try {
      setIsLoading(true);
      const response = await authService.signIn(values);
      await login(
        response.accessToken,
        response.refreshToken,
        response.user._id,
        response.user,
      );
    } catch (error: any) {
      const message = getApiErrorMessage(error, 'Please check your credentials and try again.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Sign In Failed', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password' as any);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundWhite }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && [styles.contentDesktop, { backgroundColor: colors.backgroundScreen }]]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wave header with logo */}
        {!isLargeScreen && <WaveHeader />}

        {/* Form area */}
        <View style={[styles.formSection, isLargeScreen && [styles.formSectionDesktop, { backgroundColor: colors.backgroundWhite }]]}>
          <View style={styles.logoContainer}>
            <Image 
              source={colorScheme === 'dark' ? require('../../assets/BKI LOGO/White On Dark Horiziontal.png') : require('../../assets/BKI LOGO/Horiziontal.png')} 
              style={[styles.logoImage, isLargeScreen && styles.logoImageDesktop]} 
              resizeMode="contain" 
            />
          </View>
          <Text style={[styles.title, { color: colors.primary }]}>{t('auth.signInTitle', 'Sign in to your account')}</Text>

          {/* Phone */}
          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('auth.phoneNumber', 'Phone Number')}
                placeholder={t('auth.phoneNumberPlaceholder', 'Enter your phone number')}
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phoneNumber?.message}
              />
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('auth.password', 'Password')}
                placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
                showPasswordToggle
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={handleForgotPassword}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.forgotText, { color: colors.textMuted }]}>{t('auth.forgotPassword', 'Forgot password?')}</Text>
          </TouchableOpacity>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setValue('agreedToTerms', !agreedToTerms)}
            activeOpacity={0.75}
          >
            <View style={[
              styles.checkbox, 
              { borderColor: colors.border, backgroundColor: colors.backgroundWhite },
              agreedToTerms && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}>
              {agreedToTerms && <Text style={[styles.checkmark, { color: colors.textWhite }]}>✓</Text>}
            </View>
            <Text style={[styles.termsText, { color: colors.textSecondary }]}>
              {t('auth.agreeTo', "I've read and agreed to ")}
              <Text
                style={[styles.termsLink, { color: colors.textLink }]}
                onPress={() => Linking.openURL('https://greenguard.app/terms')}
              >
                {t('auth.userAgreement', 'User Agreement')}
              </Text>
              {' '}
              {t('common.and', 'and')}
              {' '}
              <Text
                style={[styles.termsLink, { color: colors.textLink }]}
                onPress={() => Linking.openURL('https://greenguard.app/privacy')}
              >
                {t('auth.privacyPolicy', 'Privacy Policy')}
              </Text>
            </Text>
          </TouchableOpacity>
          {errors.agreedToTerms && (
            <Text style={[styles.errorText, { color: colors.error }]}>{errors.agreedToTerms.message}</Text>
          )}

          {/* Sign In button */}
          <Button
            label={t('auth.signIn', 'Sign in')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.signInButton}
          />

          {/* Create account link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('auth.noAccount', "Don't have an account? ")}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>{t('auth.createAccount', 'Create Account')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Decorative wave bottom */}
      {!isLargeScreen && <WaveFooter />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  contentDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  formSection: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  formSectionDesktop: {
    width: 460,
    borderRadius: 32,
    padding: Spacing['3xl'],
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: -Spacing.xl,
  },
  logoImage: {
    width: 200,
    height: 50,
    transform: [{ scale: 1.8 }],
  },
  logoImageDesktop: {
    width: 280,
    height: 80,
    marginTop: Spacing.xl,
    transform: [{ scale: 1.5 }],
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.base,
  },
  forgotText: {
    fontSize: FontSize.sm,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkmark: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  termsText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  termsLink: {
    fontWeight: FontWeight.medium,
  },
  errorText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  signInButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSize.sm,
  },
  footerLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },
});
