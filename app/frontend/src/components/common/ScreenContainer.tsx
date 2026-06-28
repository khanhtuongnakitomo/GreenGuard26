/**
 * GreenGuard — ScreenContainer Component
 *
 * Wraps screen content with safe area, consistent bg color,
 * and optional scroll behavior.
 */
import React, { memo } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  backgroundColor?: string;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAware?: boolean;
}

export const ScreenContainer = memo<ScreenContainerProps>(({
  children,
  scrollable = false,
  style,
  contentStyle,
  backgroundColor = Colors.backgroundWhite,
  padded = false,
  refreshing = false,
  onRefresh,
  keyboardAware = false,
}) => {
  const safeAreaStyle: ViewStyle = { flex: 1, backgroundColor };

  const inner = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        padded && styles.padded,
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.inner, padded && styles.padded, contentStyle]}>
      {children}
    </View>
  );

  const content = keyboardAware ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : inner;

  return (
    <SafeAreaView style={[safeAreaStyle, style]} edges={['top']}>
      {content}
    </SafeAreaView>
  );
});

ScreenContainer.displayName = 'ScreenContainer';

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: Spacing.screenHorizontal,
  },
});
