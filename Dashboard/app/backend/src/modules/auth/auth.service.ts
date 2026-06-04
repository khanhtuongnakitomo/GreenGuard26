import { customAlphabet } from "nanoid";
import { env } from "../../config/env";
import { compareOtp, comparePassword, hashOtp, hashPassword } from "../../utils/hash";
import { HttpError } from "../../utils/httpError";
import { generateAccessToken, generateRefreshToken } from "../../utils/token";
import type { UserRole } from "../../types/enums";
import { UserModel } from "../users/user.model";
import { OtpModel } from "./otp.model";

const otpGenerator = customAlphabet("0123456789", 6);

function authPayload(user: { id: string; role: UserRole; displayName: string; phoneNumber: string }) {
  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber
  };
}

function loginResponse(user: any) {
  const payload = authPayload({
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber
  });
  return {
    user,
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
}

export async function createUserWithPassword(input: {
  phoneNumber: string;
  password?: string;
  displayName: string;
  role: UserRole;
  faculty?: string;
  studentId?: string;
}) {
  const existing = await UserModel.findOne({ phoneNumber: input.phoneNumber });
  if (existing) throw new HttpError(409, "Phone number is already registered");

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const authMethods = input.password ? ["password", "sms_otp"] : ["sms_otp"];
  const user = await UserModel.create({
    phoneNumber: input.phoneNumber,
    passwordHash,
    authMethods,
    displayName: input.displayName,
    role: input.role,
    faculty: input.faculty,
    studentId: input.studentId,
    isPhoneVerified: false
  });

  return loginResponse(user);
}

export async function validatePasswordLogin(phoneNumber: string, password: string) {
  const user = await UserModel.findOne({ phoneNumber }).select("+passwordHash");
  if (!user?.passwordHash) throw new HttpError(401, "Invalid phone number or password");
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Invalid phone number or password");
  user.lastLoginAt = new Date();
  await user.save();
  return loginResponse(user);
}

export async function createOtp(phoneNumber: string, purpose: "login" | "register" | "reset_password") {
  const otp = otpGenerator();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000);
  await OtpModel.updateMany({ phoneNumber, status: "active" }, { status: "expired" });
  await OtpModel.create({
    phoneNumber,
    purpose,
    otpHash: await hashOtp(otp),
    expiresAt
  });
  return { phoneNumber, expiresAt, devOtp: otp };
}

export async function verifyOtpAndLogin(phoneNumber: string, otp: string) {
  const record = await OtpModel.findOne({ phoneNumber, status: "active" }).sort({ createdAt: -1 });
  if (!record) throw new HttpError(401, "OTP is invalid");
  if (record.expiresAt.getTime() < Date.now()) {
    record.status = "expired";
    await record.save();
    throw new HttpError(401, "OTP has expired");
  }

  record.attempts += 1;
  const valid = await compareOtp(otp, record.otpHash);
  if (!valid) {
    await record.save();
    throw new HttpError(401, "OTP is invalid");
  }

  record.status = "used";
  record.consumedAt = new Date();
  await record.save();

  const user =
    (await UserModel.findOne({ phoneNumber })) ||
    (await UserModel.create({ phoneNumber, displayName: "Green User", authMethods: ["sms_otp"], isPhoneVerified: true }));
  user.isPhoneVerified = true;
  user.lastLoginAt = new Date();
  await user.save();
  return loginResponse(user);
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}
