export const USER_ROLES = ["user", "operator", "admin", "partner_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const POINT_TRANSACTION_TYPES = ["earn", "redeem", "refund", "bonus", "adjustment"] as const;
export type PointTransactionType = (typeof POINT_TRANSACTION_TYPES)[number];

export const POINT_TRANSACTION_SOURCES = [
  "qr_claim",
  "reward_redeem",
  "campaign_bonus",
  "admin_adjustment",
  "refund"
] as const;
export type PointTransactionSource = (typeof POINT_TRANSACTION_SOURCES)[number];

export const ITEM_TYPES = ["plastic_bottle", "can"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
