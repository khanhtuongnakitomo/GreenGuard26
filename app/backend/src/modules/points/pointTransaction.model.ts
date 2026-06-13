import mongoose, { Schema } from "mongoose";
import { POINT_TRANSACTION_SOURCES, POINT_TRANSACTION_TYPES } from "../../types/enums";

const PointTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: POINT_TRANSACTION_TYPES, required: true },
    points: { type: Number, required: true },
    source: { type: String, enum: POINT_TRANSACTION_SOURCES, required: true },
    description: String,
    contributionSessionId: { type: Schema.Types.ObjectId, ref: "ContributionSession" },
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward" },
    balanceAfter: { type: Number, required: true }
  },
  { timestamps: true }
);

export const PointTransactionModel = mongoose.model("PointTransaction", PointTransactionSchema);
