import mongoose, { Schema } from "mongoose";
import { DEFAULT_UNIVERSITY } from "../../config/constants";
import { USER_ROLES } from "../../types/enums";

const NotificationSettingsSchema = new Schema(
  {
    rewardUpdates: { type: Boolean, default: true },
    campaignUpdates: { type: Boolean, default: true },
    milestoneUpdates: { type: Boolean, default: true }
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true, trim: true },
    passwordHash: { type: String, select: false },
    authMethods: { type: [String], enum: ["password", "sms_otp"], default: ["sms_otp"] },
    displayName: { type: String, required: true, trim: true, default: "Green User" },
    avatarUrl: String,
    role: { type: String, enum: USER_ROLES, default: "user", index: true },
    university: { type: String, default: DEFAULT_UNIVERSITY },
    faculty: { type: String, index: true },
    className: String,
    studentId: { type: String, sparse: true, index: true },
    totalPoints: { type: Number, default: 0, min: 0 },
    lifetimeEarnedPoints: { type: Number, default: 0, min: 0 },
    lifetimeRedeemedPoints: { type: Number, default: 0, min: 0 },
    totalBottles: { type: Number, default: 0, min: 0 },
    totalCans: { type: Number, default: 0, min: 0 },
    totalItems: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastContributionAt: Date,
    level: { type: String, default: "Beginner Recycler" },
    membershipTier: {
      type: String,
      enum: ["green_member", "silver", "gold", "platinum"],
      default: "green_member"
    },
    status: { type: String, enum: ["active", "inactive", "banned", "deleted"], default: "active", index: true },
    isPhoneVerified: { type: Boolean, default: false },
    notificationSettings: { type: NotificationSettingsSchema, default: () => ({}) },
    lastLoginAt: Date
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", UserSchema);
