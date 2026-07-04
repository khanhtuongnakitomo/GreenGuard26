import { HttpError } from "../../utils/httpError";
import { ContributionSessionModel } from "../contributions/contribution.model";
import { UserMilestoneModel } from "../milestones/userMilestone.model";
import { PointTransactionModel } from "../points/pointTransaction.model";
import { UserModel } from "./user.model";

export async function findUserById(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function updateUserProfile(userId: string, patch: Record<string, unknown>) {
  const user = await UserModel.findByIdAndUpdate(userId, patch, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function getUserSummary(userId: string) {
  const user = await findUserById(userId);
  const recentTransactions = await PointTransactionModel.find({ userId }).sort({ createdAt: -1 }).limit(5);
  return {
    user,
    recentTransactions,
    impact: await getUserImpactStats(userId)
  };
}

export async function getUserPointHistory(userId: string) {
  return PointTransactionModel.find({ userId }).sort({ createdAt: -1 });
}

export async function getUserImpactStats(userId: string) {
  const user = await findUserById(userId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthSessions = await ContributionSessionModel.find({
    claimedBy: userId,
    claimedAt: { $gte: monthStart },
    status: "claimed"
  });

  const month = monthSessions.reduce(
    (acc, session) => {
      for (const item of session.items) {
        if (item.itemType === "plastic_bottle") acc.bottles += item.quantity;
        if (item.itemType === "can") acc.cans += item.quantity;
        if (item.itemType === "carton") acc.cartons += item.quantity;
      }
      acc.points += session.totalPoints;
      return acc;
    },
    { bottles: 0, cans: 0, cartons: 0, points: 0 }
  );

  return {
    month,
    allTime: {
      bottles: user.totalBottles,
      cans: user.totalCans,
      cartons: user.totalCarton,
      items: user.totalItems,
      points: user.lifetimeEarnedPoints
    },
    co2KgEstimate: Number((user.totalItems * 0.034).toFixed(2))
  };
}

export async function getUserMilestoneProgress(userId: string) {
  return UserMilestoneModel.find({ userId }).populate("milestoneId").sort({ achievedAt: -1 });
}
