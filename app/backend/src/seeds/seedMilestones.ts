import { MilestoneModel } from "../modules/milestones/milestone.model";

export async function seedMilestones() {
  const milestones = [
    {
      code: "FIRST_RECYCLE",
      name: "First Recycle",
      conditionType: "total_items",
      targetValue: 1,
      rewardPoints: 0
    },
    {
      code: "BOTTLES_50",
      name: "50 Bottles Recycled",
      conditionType: "total_bottles",
      targetValue: 50,
      rewardPoints: 50
    },
    {
      code: "STREAK_7",
      name: "7-Day Streak",
      conditionType: "streak",
      targetValue: 7,
      rewardPoints: 25
    }
  ];

  for (const milestone of milestones) {
    await MilestoneModel.updateOne({ code: milestone.code }, milestone, { upsert: true });
  }
}
