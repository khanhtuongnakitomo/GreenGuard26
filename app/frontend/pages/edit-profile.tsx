import React, { useState, createElement } from 'react';
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

const editProfileSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  location: Yup.string().required('Location is required'),
  dateOfBirth: Yup.string().required('Date of Birth is required'),
});

type EditProfileValues = Yup.InferType<typeof editProfileSchema>;

const CITIES = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Nha Trang',
  'Đà Lạt',
  'Vũng Tàu',
  'Huế',
  'Biên Hòa',
  'Hạ Long',
];

const webInputStyle = {
  width: '100%',
  height: 48,
  borderRadius: 8,
  borderWidth: 1.5,
  borderStyle: 'solid',
  borderColor: Colors.border,
  paddingHorizontal: 16,
  fontSize: 16,
  backgroundColor: Colors.backgroundInput,
  color: Colors.textPrimary,
  marginBottom: 16,
  outline: 'none',
};

const WebSelect = ({ value, onChange }: any) => {
  return (
    <View style={styles.webInputContainer}>
      <Text style={styles.webLabel}>City / Location</Text>
      {createElement(
        'select',
        {
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: webInputStyle,
        },
        [
          createElement('option', { key: 'empty', value: '', disabled: true }, 'Select your city'),
          ...CITIES.map((opt) => createElement('option', { key: opt, value: opt }, opt))
        ]
      )}
    </View>
  );
};

const WebDatePicker = ({ value, onChange }: any) => {
  return (
    <View style={styles.webInputContainer}>
      <Text style={styles.webLabel}>Date of Birth</Text>
      {createElement(
        'input',
        {
          type: 'date',
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: webInputStyle,
        }
      )}
    </View>
  );
};

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
      location: user?.location || '',
      dateOfBirth: user?.dateOfBirth || '',
    },
  });

  if (!user) return null;

  const onSubmit = async (values: EditProfileValues) => {
    try {
      setIsLoading(true);
      await updateUser(values);
      if (Platform.OS === 'web') {
        window.alert('Profile updated successfully!');
        router.back();
      } else {
        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Could not update profile.');
      } else {
        Alert.alert('Error', 'Could not update profile.');
      }
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
            <Text style={styles.changeAvatarText}>Change Avatar</Text>
          </View>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                label="Full Name"
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
            name="dateOfBirth"
            render={({ field: { onChange, value, onBlur } }) => (
              Platform.OS === 'web' ? (
                <WebDatePicker value={value} onChange={onChange} />
              ) : (
                <TextInput
                  label="Date of Birth"
                  placeholder="YYYY-MM-DD"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.dateOfBirth?.message}
                />
              )
            )}
          />

          <Controller
            control={control}
            name="location"
            render={({ field: { onChange, value, onBlur } }) => (
              Platform.OS === 'web' ? (
                <WebSelect value={value} onChange={onChange} />
              ) : (
                <TextInput
                  label="City / Location"
                  placeholder="Enter your city"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.location?.message}
                />
              )
            )}
          />

          <Button
            label="Save Changes"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.saveBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundWhite,
    ...Shadows.xs,
  },
  closeBtn: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  contentDesktop: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  formSection: {
    padding: Spacing.screenHorizontal,
  },
  formSectionDesktop: {
    width: 440,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: 24,
    padding: Spacing['2xl'],
    ...Shadows.card,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  changeAvatarText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.sm,
  },
  saveBtn: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  webInputContainer: {
    marginBottom: Spacing.base,
  },
  webLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
});
