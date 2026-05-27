import mongoose, { Schema, Document } from 'mongoose';
import type {
  DetectedType,
  TargetBin,
  SortCommand,
  SortingStatus,
} from '../types';

/**
 * Detection — mỗi document là 1 lượt phân loại rác của robot.
 *
 * Indexes:
 *   - eventId        → unique (Jetson idempotency)
 *   - machineId      → query history theo robot
 *   - machineId + createdAt → compound (dashboard timeline)
 */
export interface IDetection extends Document {
  eventId: string;
  machineId: string;
  deviceModel: string;
  detectedType: DetectedType;
  confidence: number;
  targetBin: TargetBin;
  sortCommand: SortCommand;
  sortingStatus: SortingStatus;
  createdAt: Date;
  serverReceivedAt: Date;
}

const detectionSchema = new Schema<IDetection>(
  {
    eventId:        { type: String, required: true, unique: true },
    machineId:      { type: String, required: true, index: true },
    deviceModel:    { type: String, required: true },
    detectedType:   {
      type: String,
      required: true,
      enum: ['plastic_bottle', 'aluminum_can', 'paper_carton', 'unknown_object'],
    },
    confidence:     { type: Number, required: true, min: 0, max: 1 },
    targetBin:      {
      type: String,
      required: true,
      enum: ['bin_1', 'bin_2', 'bin_3', 'unknown_bin'],
    },
    sortCommand:    {
      type: String,
      required: true,
      enum: ['SORT_BIN_1', 'SORT_BIN_2', 'SORT_BIN_3', 'SORT_UNKNOWN'],
    },
    sortingStatus:  {
      type: String,
      required: true,
      enum: ['success', 'failed', 'unknown'],
    },
    createdAt:      { type: Date, required: true },
    serverReceivedAt: { type: Date, default: Date.now },
  },
  { timestamps: false } // createdAt do Jetson cung cấp
);

// Compound index: query timeline theo machineId
detectionSchema.index({ machineId: 1, createdAt: -1 });

export const Detection = mongoose.model<IDetection>('Detection', detectionSchema);
