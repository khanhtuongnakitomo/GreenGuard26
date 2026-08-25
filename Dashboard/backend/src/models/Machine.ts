/**
 * READ-ONLY SCHEMA MIRROR — Contract belongs to GreenPoint-Backend.
 * Do not perform mutations or change schema structure here.
 */
import mongoose, { Schema } from 'mongoose';

const BinCapacitySchema = new Schema(
  {
    binType: { type: String, required: true },
    capacityPercent: { type: Number, default: 0 }
  },
  { _id: false }
);

const MachineSchema = new Schema(
  {
    machineCode: { type: String, required: true },
    name: { type: String, required: true },
    locationName: { type: String, required: true },
    locationType: { type: String, default: 'other' },
    status: {
      type: String,
      enum: ['online', 'offline', 'maintenance', 'disabled'],
      default: 'offline'
    },
    lastSeenAt: Date,
    lastHeartbeatAt: Date,
    totalSessions: { type: Number, default: 0 },
    bins: { type: [BinCapacitySchema], default: [] },
    latitude: Number,
    longitude: Number
  },
  { timestamps: true, collection: 'machines' }
);

export const MachineModel = mongoose.models.Machine || mongoose.model('Machine', MachineSchema);
export default MachineModel;
