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
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Ionicons } from '@expo/vector-icons';

import { TextInput } from '@/components/common/TextInput';
import { Button } from '@/components/common/Button';
import { Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { useResponsive } from '@/hooks/useResponsive';
import { getApiErrorMessage } from '@/utils/mappers';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';

const editProfileSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  className: Yup.string().default(''),
  studentId: Yup.string().default(''),
});

type EditProfileValues = Yup.InferType<typeof editProfileSchema>;

export default function EditProfileScreen() {
  const { isLargeScreen } = useResponsive();
  const { colors } = useTheme();
  const { t } = useI18n();
  const user = useUserStore((s) => s.user);
  const updateUser = useUserStore((s) => s.updateUser);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditProfileValues>({
    resolver: yupResolver(editProfileSchema),
    defaultValues: {
      name: user?.name || '',
      className: user?.className || '',
      studentId: user?.studentId || '',
    },
  });

  if (!user) return null;

  const onSubmit = async (values: EditProfileValues) => {
    try {
      setIsLoading(true);
      await updateUser({
        name: values.name,
        className: values.className,
        studentId: values.studentId,
      });
      if (Platform.OS === 'web') {
        window.alert(t('profile.updateSuccess', 'Profile updated successfully!'));
        router.back();
      } else {
        Alert.alert(t('common.success', 'Success'), t('profile.updateSuccess', 'Profile updated successfully!'), [
          { text: t('common.ok', 'OK'), onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      const message = getApiErrorMessage(err, t('profile.updateError', 'Could not update profile.'));
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('common.error', 'Error'), message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundWhite }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('profile.editProfile', 'Edit Profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formSection, isLargeScreen && [styles.formSectionDesktop, { backgroundColor: colors.backgroundWhite }]]}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={100} color={colors.primary} />
            <Text style={[styles.changeAvatarText, { color: colors.textMuted }]}>{user.phoneNumber}</Text>
          </View>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('auth.displayName', 'Display Name')}
                placeholder={t('auth.displayNamePlaceholder', 'Enter your name')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="className"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('profile.classLabel', 'Class')}
                placeholder={t('profile.classPlaceholder', 'e.g. CS2022')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.className?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="studentId"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label={t('profile.studentIdLabel', 'Student ID')}
                placeholder={t('common.optional', 'Optional')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.studentId?.message}
              />
            )}
          />

          <Button label={t('profile.saveChanges', 'Save Changes')} onPress={handleSubmit(onSubmit)} loading={isLoading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  closeBtn: { width: 40 },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semiBold,
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing['3xl'] },
  contentDesktop: { alignItems: 'center' },
  formSection: { paddingHorizontal: Spacing.base },
  formSectionDesktop: {
    width: 460,
    ...Shadows.md,
    padding: Spacing.xl,
    borderRadius: 16,
  },
  avatarContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  changeAvatarText: { marginTop: Spacing.sm },
});
