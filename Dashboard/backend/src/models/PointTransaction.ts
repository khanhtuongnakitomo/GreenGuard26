/**
 * READ-ONLY SCHEMA MIRROR — Contract belongs to GreenPoint-Backend.
 * Do not perform mutations or change schema structure here.
 */
import mongoose, { Schema } from 'mongoose';

const PointTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    points: { type: Number, required: true },
    source: { type: String, required: true },
    description: String,
    contributionSessionId: { type: Schema.Types.ObjectId, ref: 'ContributionSession' },
    balanceAfter: Number
  },
  { timestamps: true, collection: 'pointtransactions' }
);

export const PointTransactionModel =
  mongoose.models.PointTransaction || mongoose.model('PointTransaction', PointTransactionSchema);
export default PointTransactionModel;
