/**
 * GreenGuard — Route Constants
 */

export const Routes = {
  // Root
  SPLASH: '/splash',

  // Auth
  SIGN_IN: '/(auth)/sign-in',
  SIGN_UP: '/(auth)/sign-up',

  // Main tabs
  HOME: '/(tabs)/home',
  MAP: '/(tabs)/map',
  REWARDS: '/(tabs)/rewards',
  PROFILE: '/(tabs)/profile',

  // Reward stack
  TASK_LIST: '/rewards/tasks',
  BRAND_TASK: '/rewards/brand-task',

  // QR Modal
  QR_SCAN: '/qr-scan',
} as const;

export type RouteKey = keyof typeof Routes;
