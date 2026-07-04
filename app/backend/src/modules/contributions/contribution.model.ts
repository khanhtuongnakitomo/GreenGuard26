import mongoose, { Schema } from "mongoose";
import { ITEM_TYPES } from "../../types/enums";

const ContributionItemSchema = new Schema(
  {
    itemType: { type: String, enum: ITEM_TYPES, required: true },
    quantity: { type: Number, required: true, min: 1 },
    pointsPerItem: { type: Number, required: true }
  },
  { _id: false }
);

const ContributionSessionSchema = new Schema(
  {
    sessionCode: { type: String, required: true, unique: true, index: true },
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true, index: true },
    machineName: { type: String },
    items: { type: [ContributionItemSchema], required: true },
    totalItems: { type: Number, required: true, min: 0 },
    totalPoints: { type: Number, required: true, min: 0 },
    claimTokenHash: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["unclaimed", "claimed", "expired", "cancelled"],
      default: "unclaimed",
      index: true
    },
    claimedBy: { type: Schema.Types.ObjectId, ref: "User" },
    claimedAt: Date,
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

export const ContributionSessionModel = mongoose.model("ContributionSession", ContributionSessionSchema);
