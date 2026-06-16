import type { Types } from "mongoose";
import { generateRedeemCode } from "../../utils/generateCode";
import { generateVoucherQrToken, hashQrToken } from "../../utils/qrToken";
import { HttpError } from "../../utils/httpError";
import { UserVoucherModel } from "./voucher.model";

export async function createUserVoucher(input: {
  userId: string | Types.ObjectId;
  rewardId: string | Types.ObjectId;
  partnerId: string | Types.ObjectId;
  pointsUsed: number;
  expiresAt?: Date;
}) {
  const qrToken = generateVoucherQrToken();
  const voucher = await UserVoucherModel.create({
    userId: input.userId,
    rewardId: input.rewardId,
    partnerId: input.partnerId,
    redeemCode: generateRedeemCode(),
    qrTokenHash: hashQrToken(qrToken),
    pointsUsed: input.pointsUsed,
    expiresAt: input.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  return { voucher, qrToken };
}

export async function getUserWallet(userId: string) {
  return UserVoucherModel.find({ userId }).populate({ path: "rewardId", populate: { path: "partnerId" } }).sort({ issuedAt: -1 });
}

export async function getVoucherDetail(userId: string, voucherId: string) {
  const voucher = await UserVoucherModel.findOne({ _id: voucherId, userId }).populate({
    path: "rewardId",
    populate: { path: "partnerId" }
  });
  if (!voucher) throw new HttpError(404, "Voucher not found");
  return voucher;
}

export async function getVoucherByCodeOrToken(input: { redeemCode?: string; qrToken?: string }) {
  const query = input.qrToken ? { qrTokenHash: hashQrToken(input.qrToken) } : { redeemCode: input.redeemCode };
  if (!input.qrToken && !input.redeemCode) throw new HttpError(400, "Voucher code or QR token is required");
  const voucher = await UserVoucherModel.findOne(query).populate("rewardId partnerId userId");
  if (!voucher) throw new HttpError(404, "Voucher not found");
  return voucher;
}

export async function validateVoucherUsability(input: { redeemCode?: string; qrToken?: string }) {
  const voucher = await getVoucherByCodeOrToken(input);
  if (voucher.status !== "unused") throw new HttpError(409, `Voucher is ${voucher.status}`);
  if (voucher.expiresAt.getTime() < Date.now()) {
    voucher.status = "expired";
    await voucher.save();
    throw new HttpError(410, "Voucher has expired");
  }
  return voucher;
}

export async function markVoucherAsUsed(input: {
  redeemCode?: string;
  qrToken?: string;
  operatorId: string;
  usedLocation?: string;
}) {
  const voucher = await validateVoucherUsability(input);
  voucher.status = "used";
  voucher.usedAt = new Date();
  voucher.usedByOperator = input.operatorId as unknown as Types.ObjectId;
  voucher.usedLocation = input.usedLocation;
  await voucher.save();
  return voucher;
}

export async function expireOldVouchers() {
  return UserVoucherModel.updateMany({ status: "unused", expiresAt: { $lt: new Date() } }, { status: "expired" });
}
