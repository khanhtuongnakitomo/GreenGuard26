import { HttpError } from "../../utils/httpError";
import { PartnerModel } from "./partner.model";

export async function getPartners() {
  return PartnerModel.find({ status: "active" }).sort({ name: 1 });
}

export async function getPartnerById(partnerId: string) {
  const partner = await PartnerModel.findById(partnerId);
  if (!partner) throw new HttpError(404, "Partner not found");
  return partner;
}

export async function createPartner(input: Record<string, unknown>) {
  return PartnerModel.create(input);
}

export async function updatePartner(partnerId: string, patch: Record<string, unknown>) {
  const partner = await PartnerModel.findByIdAndUpdate(partnerId, patch, { new: true, runValidators: true });
  if (!partner) throw new HttpError(404, "Partner not found");
  return partner;
}

export async function disablePartner(partnerId: string) {
  return updatePartner(partnerId, { status: "inactive" });
}
