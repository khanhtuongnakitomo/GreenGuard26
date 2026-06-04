import mongoose, { Schema } from "mongoose";

const UserMilestoneSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: "Milestone", required: true },
    achievedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

UserMilestoneSchema.index({ userId: 1, milestoneId: 1 }, { unique: true });

export const UserMilestoneModel = mongoose.model("UserMilestone", UserMilestoneSchema);
