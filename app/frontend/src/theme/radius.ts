/**
 * GreenGuard — Border Radius Tokens
 */

export const Radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  pill: 50,
  circle: 9999,

  // Semantic aliases
  input: 12,       // Input field radius
  button: 50,      // Pill button
  card: 16,        // Standard card
  cardSm: 12,      // Small card
  badge: 50,       // Badge/chip
  avatar: 9999,    // Circular avatar
  modal: 24,       // Bottom sheet / modal
  mapPin: 9999,    // Map pin circles
} as const;

export type RadiusKey = keyof typeof Radius;
