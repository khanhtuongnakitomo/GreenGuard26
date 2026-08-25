/**
 * READ-ONLY SCHEMA MIRROR — Contract belongs to GreenPoint-Backend.
 * Do not perform mutations or change schema structure here.
 */
import mongoose, { Schema } from 'mongoose';

const ContributionItemSchema = new Schema(
  {
    itemType: { type: String, required: true },
    quantity: { type: Number, required: true },
    pointsPerItem: { type: Number, required: true },
    avgConfidence: Number
  },
  { _id: false }
);

const ContributionSessionSchema = new Schema(
  {
    sessionCode: { type: String, required: true },
    machineId: { type: Schema.Types.ObjectId, ref: 'Machine', required: true },
    machineName: String,
    items: { type: [ContributionItemSchema], required: true },
    totalItems: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    status: {
      type: String,
      enum: ['unclaimed', 'claimed', 'expired', 'cancelled'],
      default: 'unclaimed'
    },
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    claimedAt: Date,
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true, collection: 'contributionsessions' }
);

export const ContributionSessionModel =
  mongoose.models.ContributionSession || mongoose.model('ContributionSession', ContributionSessionSchema);
export default ContributionSessionModel;
