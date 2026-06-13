import mongoose, { Schema } from "mongoose";

const RewardSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    name: { type: String, required: true },
    description: String,
    rewardType: {
      type: String,
      enum: ["parking_ticket", "meal_voucher", "promo_code", "free_item", "discount"],
      required: true
    },
    pointsRequired: { type: Number, required: true, min: 0 },
    valueVnd: { type: Number, min: 0 },
    quantityTotal: Number,
    quantityRemaining: Number,
    validFrom: Date,
    validUntil: Date,
    terms: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive", "expired"], default: "active", index: true }
  },
  { timestamps: true }
);

export const RewardModel = mongoose.model("Reward", RewardSchema);
