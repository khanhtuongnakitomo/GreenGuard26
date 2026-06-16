import mongoose, { Schema } from "mongoose";

const PartnerSchema = new Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["university", "brand", "retailer", "canteen", "parking"],
      required: true
    },
    logoUrl: String,
    description: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true }
  },
  { timestamps: true }
);

export const PartnerModel = mongoose.model("Partner", PartnerSchema);
