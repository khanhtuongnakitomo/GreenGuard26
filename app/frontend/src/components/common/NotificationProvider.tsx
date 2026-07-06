/**
 * GreenGuard — Notification Toast Component
 *
 * Slides in from top, auto-dismisses, supports manual close.
 * Renders a single notification from the queue.
 */
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadows } from '@/theme';
import {
  useNotificationStore,
  NotificationItem,
  NotificationType,
} from '@/store/notificationStore';

// ─── Config per type ──────────────────────────────────────────────────────────

interface TypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  label: string;
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  success: {
    icon: 'checkmark-circle',
    iconColor: Colors.success,
    bgColor: Colors.successLight,
    borderColor: Colors.border,
    label: 'Success',
  },
  warning: {
    icon: 'warning',
    iconColor: Colors.warning,
    bgColor: Colors.warningLight,
    borderColor: '#FCD34D',
    label: 'Warning',
  },
  error: {
    icon: 'close-circle',
    iconColor: Colors.error,
    bgColor: Colors.errorLight,
    borderColor: '#FCA5A5',
    label: 'Error',
  },
  info: {
    icon: 'information-circle',
    iconColor: Colors.info,
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    label: 'Info',
  },
  reward_claimed: {
    icon: 'gift',
    iconColor: Colors.rankingGold,
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    label: 'Reward',
  },
  points_earned: {
    icon: 'leaf',
    iconColor: Colors.primary,
    bgColor: Colors.successLight,
    borderColor: Colors.border,
    label: 'Points',
  },
  mission_completed: {
    icon: 'trophy',
    iconColor: Colors.rankingGold,
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    label: 'Mission',
  },
  voucher_redeemed: {
    icon: 'ticket',
    iconColor: Colors.info,
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    label: 'Voucher',
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get('window');
const TOAST_MAX_W = Math.min(W - Spacing.base * 2, 420);

interface ToastProps {
  notification: NotificationItem;
  onDismiss: () => void;
}

const Toast = ({ notification, onDismiss }: ToastProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const config = TYPE_CONFIG[notification.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateOut = () => {
    'worklet';
    translateY.value = withTiming(-120, { duration: 300, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(onDismiss)();
    });
    opacity.value = withTiming(0, { duration: 250 });
  };

  useEffect(() => {
    // Slide in
    translateY.value = withSpring(0, { damping: 14, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto dismiss
    timerRef.current = setTimeout(() => {
      animateOut();
    }, notification.duration ?? 3500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification.id]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleManualDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    animateOut();
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + Spacing.sm,
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        },
        containerStyle,
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: config.iconColor + '20' }]}>
        <Ionicons name={config.icon} size={22} color={config.iconColor} />
      </View>

      {/* Text */}
      <View style={styles.textArea}>
        <Text style={styles.toastTitle}>{notification.title}</Text>
        {notification.message && (
          <Text style={styles.toastMessage} numberOfLines={2}>
            {notification.message}
          </Text>
        )}
      </View>

      {/* Close */}
      <TouchableOpacity
        onPress={handleManualDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider = () => {
  const current = useNotificationStore((s) => s.current);
  const dismissCurrent = useNotificationStore((s) => s.dismissCurrent);

  if (!current) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Toast
        key={current.id}
        notification={current}
        onDismiss={dismissCurrent}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  } as any,
  toast: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: TOAST_MAX_W,
    width: W - Spacing.base * 2,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textArea: { flex: 1 },
  toastTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  toastMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
