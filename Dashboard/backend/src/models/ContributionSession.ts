/** Recycling session assembled by the local demo ingestion endpoint. */
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
    sessionCode: { type: String, required: true, unique: true, index: true },
    machineId: { type: Schema.Types.ObjectId, ref: 'Machine', required: true },
    machineCode: String,
    machineName: String,
    items: { type: [ContributionItemSchema], required: true },
    totalItems: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    finalizationMode: {
      type: String,
      enum: ['manual', 'inactivity'],
      default: 'inactivity',
      index: true
    },
    status: {
      type: String,
      enum: ['collecting', 'unclaimed', 'claimed', 'expired', 'cancelled'],
      default: 'unclaimed'
    },
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    claimedAt: Date,
    expiresAt: { type: Date, required: true },
    lastDetectionAt: Date,
    closedAt: Date,
    claimTokenHash: { type: String, index: true, select: false },
    qrPayload: String
  },
  { timestamps: true, collection: 'contributionsessions' }
);

export const ContributionSessionModel =
  mongoose.models.ContributionSession || mongoose.model('ContributionSession', ContributionSessionSchema);
export default ContributionSessionModel;
