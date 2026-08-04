/**
 * GreenGuard — TextInput Component
 *
 * Features:
 * - Label above input
 * - Placeholder text
 * - Optional right icon (eye toggle for passwords)
 * - Error state with message
 * - Focus animation
 */
import React, { memo, useState, forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize, FontWeight } from '@/theme';
import { useTheme } from '@/hooks/useTheme';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  showPasswordToggle?: boolean;
}

export const TextInput = memo(
  forwardRef<RNTextInput, TextInputProps>(
    (
      {
        label,
        error,
        containerStyle,
        showPasswordToggle = false,
        secureTextEntry,
        style,
        ...props
      },
      ref,
    ) => {
      const { colors } = useTheme();
      const [isFocused, setIsFocused] = useState(false);
      const [isPasswordVisible, setIsPasswordVisible] = useState(false);

      const isSecure = showPasswordToggle ? !isPasswordVisible : secureTextEntry;

      return (
        <View style={[styles.container, containerStyle]}>
          {label && (
            <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
          )}
          <View
            style={[
              styles.inputWrapper,
              {
                borderColor: !!error ? colors.error : isFocused ? colors.primary : colors.border,
                backgroundColor: colors.backgroundInput,
              },
            ]}
          >
            <RNTextInput
              ref={ref}
              style={[styles.input, { color: colors.textPrimary }, style]}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={isSecure}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              {...props}
            />
            {showPasswordToggle && (
              <TouchableOpacity
                onPress={() => setIsPasswordVisible((v) => !v)}
                style={styles.iconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
          {!!error && (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          )}
        </View>
      );
    },
  ),
);

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Spacing.inputHeight,
    borderWidth: 1.5,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.base,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    paddingVertical: 0,
  },
  iconButton: {
    paddingLeft: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});
