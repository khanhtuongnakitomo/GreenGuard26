import mongoose, { Schema, Document } from 'mongoose';
import type { MachineState } from '../types';

/**
 * MachineHeartbeat — lịch sử heartbeat (append-only).
 * Dashboard dùng để hiện bảng log heartbeat gần nhất.
 */
export interface IMachineHeartbeat extends Document {
  machineId: string;
  state: MachineState;
  lastEventId: string | null;
  createdAt: Date;
}

const machineHeartbeatSchema = new Schema<IMachineHeartbeat>(
  {
    machineId:   { type: String, required: true, index: true },
    state:       {
      type: String,
      enum: ['IDLE', 'SORTING', 'SYNCING', 'ERROR'],
      default: 'IDLE',
    },
    lastEventId: { type: String, default: null },
    createdAt:   { type: Date, required: true },
  },
  { timestamps: false }
);

export const MachineHeartbeat = mongoose.model<IMachineHeartbeat>(
  'MachineHeartbeat',
  machineHeartbeatSchema
);
