import { HttpError } from "../../utils/httpError";
import { createPointTransaction } from "../points/point.service";
import { UserModel } from "../users/user.model";
import { MilestoneModel } from "./milestone.model";
import { UserMilestoneModel } from "./userMilestone.model";

export async function getMilestones() {
  return MilestoneModel.find({ status: "active" }).sort({ targetValue: 1 });
}

export async function createMilestone(input: Record<string, unknown>) {
  return MilestoneModel.create(input);
}

export async function updateMilestone(milestoneId: string, patch: Record<string, unknown>) {
  const milestone = await MilestoneModel.findByIdAndUpdate(milestoneId, patch, { new: true, runValidators: true });
  if (!milestone) throw new HttpError(404, "Milestone not found");
  return milestone;
}

export async function getUserMilestoneProgress(userId: string) {
  const [milestones, achieved, user] = await Promise.all([
    MilestoneModel.find({ status: "active" }),
    UserMilestoneModel.find({ userId }),
    UserModel.findById(userId)
  ]);
  if (!user) throw new HttpError(404, "User not found");
  const achievedIds = new Set(achieved.map((item) => item.milestoneId.toString()));
  return milestones.map((milestone) => ({
    milestone,
    achieved: achievedIds.has(milestone.id),
    currentValue: getConditionValue(user, milestone.conditionType)
  }));
}

export async function checkMilestonesAfterContribution(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  const milestones = await MilestoneModel.find({ status: "active" });
  const granted = [];

  for (const milestone of milestones) {
    const current = getConditionValue(user, milestone.conditionType);
    if (current < milestone.targetValue) continue;
    const exists = await UserMilestoneModel.findOne({ userId, milestoneId: milestone._id });
    if (exists) continue;
    const userMilestone = await UserMilestoneModel.create({ userId, milestoneId: milestone._id });
    granted.push(userMilestone);
    if (milestone.rewardPoints > 0) {
      await createPointTransaction({
        userId,
        type: "bonus",
        source: "campaign_bonus",
        points: milestone.rewardPoints,
        description: `Milestone bonus: ${milestone.name}`
      });
    }
  }

  return granted;
}

function getConditionValue(user: any, conditionType: string) {
  if (conditionType === "total_items") return user.totalItems;
  if (conditionType === "total_bottles") return user.totalBottles;
  if (conditionType === "total_cans") return user.totalCans;
  if (conditionType === "streak") return user.currentStreak;
  return user.lifetimeEarnedPoints;
}
