import type { Types } from "mongoose";
import { HttpError } from "../../utils/httpError";
import type { PointTransactionSource, PointTransactionType } from "../../types/enums";
import { UserModel } from "../users/user.model";
import { PointTransactionModel } from "./pointTransaction.model";

type CreatePointTransactionInput = {
  userId: string | Types.ObjectId;
  type: PointTransactionType;
  points: number;
  source: PointTransactionSource;
  description?: string;
  contributionSessionId?: string | Types.ObjectId;
  rewardId?: string | Types.ObjectId;
};

export async function createPointTransaction(input: CreatePointTransactionInput) {
  const user = await UserModel.findById(input.userId);
  if (!user) throw new HttpError(404, "User not found");

  const nextBalance = user.totalPoints + input.points;
  if (nextBalance < 0) throw new HttpError(400, "Point balance cannot be negative");

  user.totalPoints = nextBalance;
  if (input.points > 0 && ["earn", "bonus", "refund", "adjustment"].includes(input.type)) {
    user.lifetimeEarnedPoints += input.points;
  }
  if (input.points < 0 && input.type === "redeem") {
    user.lifetimeRedeemedPoints += Math.abs(input.points);
  }
  await user.save();

  return PointTransactionModel.create({
    ...input,
    balanceAfter: nextBalance
  });
}

export async function createEarnTransaction(input: Omit<CreatePointTransactionInput, "type" | "source">) {
  return createPointTransaction({ ...input, type: "earn", source: "qr_claim" });
}

export async function createRedeemTransaction(input: Omit<CreatePointTransactionInput, "type" | "source">) {
  return createPointTransaction({ ...input, type: "redeem", source: "reward_redeem" });
}

export async function createAdjustmentTransaction(userId: string, points: number, description: string) {
  return createPointTransaction({
    userId,
    points,
    description,
    type: "adjustment",
    source: "admin_adjustment"
  });
}

export async function getMyPointTransactions(userId: string) {
  return PointTransactionModel.find({ userId }).sort({ createdAt: -1 });
}

export async function recalculateUserPointBalance(userId: string) {
  const transactions = await PointTransactionModel.find({ userId });
  const balance = transactions.reduce((sum, tx) => sum + tx.points, 0);
  const user = await UserModel.findByIdAndUpdate(userId, { totalPoints: Math.max(0, balance) }, { new: true });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}
