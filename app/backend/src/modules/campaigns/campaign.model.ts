import mongoose, { Schema } from "mongoose";

const CampaignSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    bonusMultiplier: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "inactive", "ended"], default: "active", index: true }
  },
  { timestamps: true }
);

export const CampaignModel = mongoose.model("Campaign", CampaignSchema);
