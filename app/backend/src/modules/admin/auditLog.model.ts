import mongoose, { Schema } from "mongoose";

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    entityType: String,
    entityId: String,
    metadata: Schema.Types.Mixed
  },
  { timestamps: true }
);

export const AuditLogModel = mongoose.model("AuditLog", AuditLogSchema);
