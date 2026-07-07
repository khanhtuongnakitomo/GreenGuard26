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
import { Colors, Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { signInSchema, SignInFormValues } from '@/utils/validators';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { useResponsive } from '@/hooks/useResponsive';

export default function SignInScreen() {
  const { isLargeScreen } = useResponsive();
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
      email: '',
      password: '',
      agreedToTerms: false,
    },
  });

  const agreedToTerms = watch('agreedToTerms');

  const onSubmit = async (values: SignInFormValues) => {
    try {
      setIsLoading(true);
      const response = await authService.signIn(values);
      await login(response.tokens.accessToken, response.tokens.refreshToken, response.userId);
      // Navigation is handled by the auth gate in pages/_layout.tsx, which
      // watches `isAuthenticated` and redirects out of the (auth) group.
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(error.message || 'Please check your credentials and try again.');
      } else {
        Alert.alert('Sign In Failed', error.message || 'Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset feature coming soon.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wave header with logo */}
        {!isLargeScreen && <WaveHeader />}

        {/* Form area */}
        <View style={[styles.formSection, isLargeScreen && styles.formSectionDesktop]}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/BKI LOGO/Horiziontal.png')} 
              style={[styles.logoImage, isLargeScreen && styles.logoImageDesktop]} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.title}>Sign in to your account</Text>

          {/* Email */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label="Email Address"
                placeholder="Enter your email address"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label="Password"
                placeholder="Enter your password"
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
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setValue('agreedToTerms', !agreedToTerms)}
            activeOpacity={0.75}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              {"I've read and agreed to "}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://greenguard.app/terms')}
              >
                User Agreement
              </Text>
              {' and '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://greenguard.app/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
          {errors.agreedToTerms && (
            <Text style={styles.errorText}>{errors.agreedToTerms.message}</Text>
          )}

          {/* Sign In button */}
          <Button
            label="Sign in"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.signInButton}
          />

          {/* Create account link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{"Don't have an account? "}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.footerLink}>Create Account</Text>
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
    backgroundColor: Colors.backgroundWhite,
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
    backgroundColor: Colors.backgroundScreen,
    paddingVertical: Spacing['2xl'],
  },
  formSection: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  formSectionDesktop: {
    width: 460,
    backgroundColor: Colors.backgroundWhite,
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
    color: Colors.primary,
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
    color: Colors.textMuted,
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
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 11,
    color: Colors.textWhite,
    fontWeight: FontWeight.bold,
  },
  termsText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.textLink,
    fontWeight: FontWeight.medium,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
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
    color: Colors.textMuted,
  },
  footerLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
});
