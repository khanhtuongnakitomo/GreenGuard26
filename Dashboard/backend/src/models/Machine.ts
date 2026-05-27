import mongoose, { Schema, Document } from 'mongoose';
import type { MachineState } from '../types';

/**
 * Machine — trạng thái hiện tại của robot.
 * Upsert mỗi khi Jetson gửi heartbeat.
 */
export interface IMachine extends Document {
  machineId: string;
  name: string;
  location: string;
  hardware: {
    edgeComputer: string;
    controller: string;
  };
  currentState: MachineState;
  lastEventId: string | null;
  lastSeenAt: Date | null;
}

const machineSchema = new Schema<IMachine>(
  {
    machineId:    { type: String, required: true, unique: true },
    name:         { type: String, default: '' },
    location:     { type: String, default: '' },
    hardware: {
      edgeComputer: { type: String, default: '' },
      controller:   { type: String, default: '' },
    },
    currentState: {
      type: String,
      enum: ['IDLE', 'SORTING', 'SYNCING', 'ERROR'],
      default: 'IDLE',
    },
    lastEventId:  { type: String, default: null },
    lastSeenAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

export const Machine = mongoose.model<IMachine>('Machine', machineSchema);
