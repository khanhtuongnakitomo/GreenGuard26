import { AuditLogModel } from "../admin/auditLog.model";
import { UserVoucherModel } from "../vouchers/voucher.model";
import { markVoucherAsUsed, validateVoucherUsability } from "../vouchers/voucher.service";

export async function validateVoucher(input: { redeemCode?: string; qrToken?: string }) {
  return validateVoucherUsability(input);
}

export async function useVoucher(input: {
  redeemCode?: string;
  qrToken?: string;
  operatorId: string;
  usedLocation?: string;
}) {
  const voucher = await markVoucherAsUsed(input);
  await AuditLogModel.create({
    actorId: input.operatorId,
    action: "voucher.used",
    entityType: "UserVoucher",
    entityId: voucher.id,
    metadata: { usedLocation: input.usedLocation }
  });
  return voucher;
}

export async function getOperatorHistory(operatorId: string) {
  return UserVoucherModel.find({ usedByOperator: operatorId }).populate("rewardId partnerId userId").sort({ usedAt: -1 });
}
