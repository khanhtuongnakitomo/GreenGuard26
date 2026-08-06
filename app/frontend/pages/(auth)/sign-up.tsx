/**
 * GreenGuard — Sign Up Screen
 *
 * Figma design:
 * - Same wave header structure as Sign In
 * - Title: "Create new account"
 * - Email + Password (with eye) + Username (with eye) inputs
 * - Terms checkbox
 * - Dark green "Sign up" button
 * - Social auth buttons
 * - "Already have an account? Back to Sign In" footer
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
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
import { signUpSchema, SignUpFormValues } from '@/utils/validators';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { useResponsive } from '@/hooks/useResponsive';
import { getApiErrorMessage } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

export default function SignUpScreen() {
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
  } = useForm<SignUpFormValues>({
    resolver: yupResolver(signUpSchema),
    defaultValues: {
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      displayName: '',
      agreedToTerms: false,
    },
  });

  const agreedToTerms = watch('agreedToTerms');

  const onSubmit = async (values: SignUpFormValues) => {
    try {
      setIsLoading(true);
      const response = await authService.signUp(values);
      await login(
        response.accessToken,
        response.refreshToken,
        response.user._id,
        response.user,
      );
    } catch (error: any) {
      const message = getApiErrorMessage(error, 'Please try again later.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(t('auth.signUpFailed', 'Sign Up Failed'), message);
      }
    } finally {
      setIsLoading(false);
    }
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
          <Text style={[styles.title, { color: colors.primary }]}>{t('auth.createAccount', 'Create new account')}</Text>

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

          {/* Display name */}
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('auth.displayName', 'Display Name')}
                placeholder={t('auth.displayNamePlaceholder', 'Enter your name')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.displayName?.message}
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
                placeholder={t('auth.passwordPlaceholderSignUp', 'Enter your password (min 6 characters)')}
                showPasswordToggle
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          {/* Confirm Password */}
          <Controller
            control={control}
            name="confirmPassword"
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

          <Button
            label={t('auth.signUp', 'Sign up')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.signUpButton}
          />

          {/* Back to sign in */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('auth.alreadyHaveAccount', 'Already have an account? ')}</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>{t('auth.backToSignIn', 'Back to Sign In')}</Text>
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
    marginBottom: Spacing.sm,
    marginTop: -Spacing.md,
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
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
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
  signUpButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
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
