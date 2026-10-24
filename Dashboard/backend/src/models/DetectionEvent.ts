/** Detection log written by the local demo ingestion endpoint. */
import mongoose, { Schema } from 'mongoose';

const DetectionEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    machineId: { type: Schema.Types.ObjectId, ref: 'Machine', required: true },
    machineCode: { type: String, required: true },
    detectedType: {
      type: String,
      enum: ['pet_clean', 'pet_bad', 'aluminum', 'reject'],
      required: true
    },
    confidence: { type: Number, required: true },
    sessionCode: { type: String, index: true },
    fps: Number,
    latencyMs: Number,
    snapshotUrl: String,
    sortingStatus: {
      type: String,
      enum: ['sorted', 'failed', 'skipped'],
      default: 'sorted'
    },
    syncStatus: {
      type: String,
      enum: ['synced'],
      default: 'synced'
    },
    capturedAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'detectionevents' }
);

export const DetectionEventModel =
  mongoose.models.DetectionEvent || mongoose.model('DetectionEvent', DetectionEventSchema);
export default DetectionEventModel;
