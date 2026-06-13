import mongoose, { Schema } from "mongoose";

const UserVoucherSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    redeemCode: { type: String, required: true, unique: true, index: true },
    qrTokenHash: { type: String, required: true },
    pointsUsed: { type: Number, required: true },
    status: {
      type: String,
      enum: ["unused", "used", "expired", "cancelled"],
      default: "unused",
      index: true
    },
    issuedAt: { type: Date, default: Date.now },
    usedAt: Date,
    expiresAt: { type: Date, required: true, index: true },
    usedLocation: String,
    usedByOperator: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const UserVoucherModel = mongoose.model("UserVoucher", UserVoucherSchema);
