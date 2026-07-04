import mongoose, { Schema } from "mongoose";

const BinCapacitySchema = new Schema(
  {
    binType: { 
      type: String, 
      enum: ["plastic_bottle", "can", "carton"], 
      required: true 
    },
    capacityPercent: { type: Number, default: 0, min: 0, max: 100 }
  },
  { _id: false }
);

const MachineSchema = new Schema(
  {
    machineCode: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true,
      match: [/^(?!0000)\d{4}$/, 'Machine code must be a 4-digit number from 0001 to 9999']
    },
    name: { type: String, required: true },
    locationName: { type: String, required: true },
    locationType: {
      type: String,
      enum: ["canteen", "parking", "library", "classroom_area", "other"],
      default: "other"
    },
    apiKeyHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["online", "offline", "maintenance", "disabled"],
      default: "offline",
      index: true
    },
    lastSeenAt: Date,
    totalSessions: { type: Number, default: 0 },
    bins: { type: [BinCapacitySchema], default: [] }
  },
  { timestamps: true }
);

export const MachineModel = mongoose.model("Machine", MachineSchema);
