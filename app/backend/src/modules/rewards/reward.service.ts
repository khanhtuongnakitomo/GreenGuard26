import { HttpError } from "../../utils/httpError";
import { createRedeemTransaction } from "../points/point.service";
import { UserModel } from "../users/user.model";
import { createUserVoucher } from "../vouchers/voucher.service";
import { RewardModel } from "./reward.model";

export async function listActiveRewards() {
  return RewardModel.find({ status: "active" }).populate("partnerId").sort({ pointsRequired: 1 });
}

export async function getRewardById(rewardId: string) {
  const reward = await RewardModel.findById(rewardId).populate("partnerId");
  if (!reward) throw new HttpError(404, "Reward not found");
  return reward;
}

export async function validateRewardAvailability(rewardId: string) {
  const reward = await RewardModel.findById(rewardId);
  if (!reward) throw new HttpError(404, "Reward not found");
  if (reward.status !== "active") throw new HttpError(409, "Reward is not active");
  if (reward.validFrom && reward.validFrom.getTime() > Date.now()) throw new HttpError(409, "Reward is not available yet");
  if (reward.validUntil && reward.validUntil.getTime() < Date.now()) throw new HttpError(410, "Reward has expired");
  if (typeof reward.quantityRemaining === "number" && reward.quantityRemaining <= 0) {
    throw new HttpError(409, "Reward is out of stock");
  }
  return reward;
}

export async function redeemRewardForUser(userId: string, rewardId: string) {
  const reward = await validateRewardAvailability(rewardId);
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  if (user.totalPoints < reward.pointsRequired) throw new HttpError(402, "Not enough points");

  const transaction = await createRedeemTransaction({
    userId,
    points: -reward.pointsRequired,
    description: `Redeemed ${reward.name}`,
    rewardId: reward._id
  });

  const { voucher, qrToken } = await createUserVoucher({
    userId,
    rewardId: reward._id,
    partnerId: reward.partnerId,
    pointsUsed: reward.pointsRequired,
    expiresAt: reward.validUntil ?? undefined
  });

  if (typeof reward.quantityRemaining === "number") {
    reward.quantityRemaining -= 1;
    await reward.save();
  }

  return { reward, transaction, voucher, qrToken };
}

export async function createReward(input: Record<string, unknown>) {
  return RewardModel.create(input);
}

export async function updateReward(rewardId: string, patch: Record<string, unknown>) {
  const reward = await RewardModel.findByIdAndUpdate(rewardId, patch, { new: true, runValidators: true });
  if (!reward) throw new HttpError(404, "Reward not found");
  return reward;
}

export async function deleteReward(rewardId: string) {
  return updateReward(rewardId, { status: "inactive" });
}
