export type UserRole = "user" | "operator" | "admin" | "partner_admin";

export type User = {
  _id: string;
  id?: string;
  phoneNumber: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  university?: string;
  faculty?: string;
  totalPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  totalBottles: number;
  totalCans: number;
  totalItems: number;
  currentStreak: number;
  longestStreak: number;
  membershipTier: string;
};
