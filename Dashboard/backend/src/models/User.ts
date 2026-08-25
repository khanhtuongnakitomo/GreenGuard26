/**
 * READ-ONLY SCHEMA MIRROR — Contract belongs to GreenPoint-Backend.
 * Do not perform mutations or change schema structure here.
 */
import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    phoneNumber: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: String,
    role: { type: String, default: 'user' },
    className: String,
    studentId: String,
    totalPoints: { type: Number, default: 0 },
    lifetimeEarnedPoints: { type: Number, default: 0 },
    lifetimeRedeemedPoints: { type: Number, default: 0 },
    totals: {
      pet_clean: { type: Number, default: 0 },
      pet_bad: { type: Number, default: 0 },
      aluminum: { type: Number, default: 0 },
      points: { type: Number, default: 0 }
    },
    totalItems: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastContributionAt: Date,
    membershipTier: { type: String, default: 'green_member' }
  },
  { timestamps: true, collection: 'users' }
);

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export default UserModel;
