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
import { Colors, Spacing, FontSize, FontWeight, Shadows } from '@/theme';
import { useUserStore } from '@/store/userStore';
import { useResponsive } from '@/hooks/useResponsive';
import { getApiErrorMessage } from '@/utils/mappers';

const editProfileSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  className: Yup.string().default(''),
  studentId: Yup.string().default(''),
});

type EditProfileValues = Yup.InferType<typeof editProfileSchema>;

export default function EditProfileScreen() {
  const { isLargeScreen } = useResponsive();
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
        window.alert('Profile updated successfully!');
        router.back();
      } else {
        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      const message = getApiErrorMessage(err, 'Could not update profile.');
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isLargeScreen && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formSection, isLargeScreen && styles.formSectionDesktop]}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={100} color={Colors.primary} />
            <Text style={styles.changeAvatarText}>{user.phoneNumber}</Text>
          </View>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label="Display Name"
                placeholder="Enter your name"
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
                label="Class"
                placeholder="e.g. CS2022"
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
                label="Student ID"
                placeholder="Optional"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.studentId?.message}
              />
            )}
          />

          <Button label="Save Changes" onPress={handleSubmit(onSubmit)} loading={isLoading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundWhite },
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
    color: Colors.textPrimary,
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing['3xl'] },
  contentDesktop: { alignItems: 'center' },
  formSection: { paddingHorizontal: Spacing.base },
  formSectionDesktop: {
    width: 460,
    ...Shadows.md,
    backgroundColor: Colors.backgroundWhite,
    padding: Spacing.xl,
    borderRadius: 16,
  },
  avatarContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  changeAvatarText: { color: Colors.textMuted, marginTop: Spacing.sm },
});
