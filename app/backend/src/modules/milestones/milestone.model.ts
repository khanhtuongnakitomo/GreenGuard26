import mongoose, { Schema } from "mongoose";

const MilestoneSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    conditionType: {
      type: String,
      enum: ["total_items", "total_bottles", "total_cans", "streak", "monthly_points"],
      required: true
    },
    targetValue: { type: Number, required: true },
    rewardPoints: { type: Number, default: 0 },
    badgeIcon: String,
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

export const MilestoneModel = mongoose.model("Milestone", MilestoneSchema);
