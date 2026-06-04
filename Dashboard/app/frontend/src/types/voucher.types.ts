import type { Reward } from "./reward.types";

export type UserVoucher = {
  _id: string;
  rewardId: Reward;
  redeemCode: string;
  pointsUsed: number;
  status: "unused" | "used" | "expired" | "cancelled";
  expiresAt: string;
  usedAt?: string;
};
