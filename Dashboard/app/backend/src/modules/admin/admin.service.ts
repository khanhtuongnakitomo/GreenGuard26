import { AuditLogModel } from "./auditLog.model";
import { CampaignModel } from "../campaigns/campaign.model";
import { ContributionSessionModel } from "../contributions/contribution.model";
import { MachineModel } from "../machines/machine.model";
import { PartnerModel } from "../partners/partner.model";
import { PointTransactionModel } from "../points/pointTransaction.model";
import { RewardModel } from "../rewards/reward.model";
import { UserModel } from "../users/user.model";
import { UserVoucherModel } from "../vouchers/voucher.model";

export async function getOverview() {
  const [
    users,
    machines,
    partners,
    rewards,
    vouchersIssued,
    sessions,
    campaigns,
    pointAgg,
    recentAuditLogs
  ] = await Promise.all([
    UserModel.countDocuments(),
    MachineModel.countDocuments(),
    PartnerModel.countDocuments(),
    RewardModel.countDocuments(),
    UserVoucherModel.countDocuments(),
    ContributionSessionModel.countDocuments(),
    CampaignModel.countDocuments(),
    PointTransactionModel.aggregate([{ $group: { _id: "$type", points: { $sum: "$points" }, count: { $sum: 1 } } }]),
    AuditLogModel.find().sort({ createdAt: -1 }).limit(20)
  ]);

  return {
    users,
    machines,
    partners,
    rewards,
    vouchersIssued,
    sessions,
    campaigns,
    pointTransactions: pointAgg,
    recentAuditLogs
  };
}

export async function getContributionReport() {
  return ContributionSessionModel.find().populate("machineId claimedBy").sort({ createdAt: -1 }).limit(500);
}

export async function getRewardReport() {
  return RewardModel.find().populate("partnerId").sort({ createdAt: -1 }).limit(500);
}

export async function getUserReport() {
  return UserModel.find().sort({ createdAt: -1 }).limit(500);
}

export async function getPartnerReport() {
  return PartnerModel.find().sort({ createdAt: -1 }).limit(500);
}
