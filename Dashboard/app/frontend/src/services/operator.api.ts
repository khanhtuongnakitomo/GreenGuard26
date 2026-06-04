import { apiClient } from "./apiClient";

export async function validateVoucher(redeemCode: string) {
  const { data } = await apiClient.post("/operator/vouchers/validate", { redeemCode });
  return data;
}

export async function useVoucher(redeemCode: string, usedLocation?: string) {
  const { data } = await apiClient.post("/operator/vouchers/use", { redeemCode, usedLocation });
  return data;
}
