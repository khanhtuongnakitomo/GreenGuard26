import mongoose, { Schema } from "mongoose";

const MachineSchema = new Schema(
  {
    machineCode: { type: String, required: true, unique: true, index: true },
    name: String,
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
    totalSessions: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const MachineModel = mongoose.model("Machine", MachineSchema);
