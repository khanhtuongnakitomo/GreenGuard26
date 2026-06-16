import mongoose, { Schema } from "mongoose";

const OtpSchema = new Schema(
  {
    phoneNumber: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["login", "register", "reset_password"], default: "login" },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: Date,
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "used", "expired"], default: "active" }
  },
  { timestamps: true }
);

export const OtpModel = mongoose.model("Otp", OtpSchema);
