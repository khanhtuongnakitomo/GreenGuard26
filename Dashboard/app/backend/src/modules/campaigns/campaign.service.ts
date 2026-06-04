import { HttpError } from "../../utils/httpError";
import { CampaignModel } from "./campaign.model";

export async function getActiveCampaigns() {
  const now = new Date();
  return CampaignModel.find({ status: "active", startsAt: { $lte: now }, endsAt: { $gte: now } }).sort({ startsAt: -1 });
}

export async function getCampaignById(campaignId: string) {
  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign) throw new HttpError(404, "Campaign not found");
  return campaign;
}

export async function createCampaign(input: Record<string, unknown>) {
  return CampaignModel.create(input);
}

export async function updateCampaign(campaignId: string, patch: Record<string, unknown>) {
  const campaign = await CampaignModel.findByIdAndUpdate(campaignId, patch, { new: true, runValidators: true });
  if (!campaign) throw new HttpError(404, "Campaign not found");
  return campaign;
}

export async function deleteCampaign(campaignId: string) {
  return updateCampaign(campaignId, { status: "inactive" });
}
