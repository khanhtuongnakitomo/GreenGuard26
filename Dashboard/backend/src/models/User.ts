import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true, trim: true },
    passwordHash: { type: String, select: false },
    authMethods: { type: [String], default: ["sms_otp"] },
    displayName: { type: String, required: true, trim: true, default: "Green User" },
    avatar: { type: String, default: "default-avatar.png" },
    role: { type: String, default: "user", index: true },
    className: String,
    studentId: { type: String, sparse: true, index: true },
    totalPoints: { type: Number, default: 0, min: 0 },
    lifetimeEarnedPoints: { type: Number, default: 0, min: 0 },
    lifetimeRedeemedPoints: { type: Number, default: 0, min: 0 },
    totalBottles: { type: Number, default: 0, min: 0 },
    totalCans: { type: Number, default: 0, min: 0 },
    totalCarton: { type: Number, default: 0, min: 0 },
    totalItems: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastContributionAt: Date,
    membershipTier: {
      type: String,
      default: "green_member"
    },
    notificationSettings: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
