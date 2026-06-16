import { apiClient } from "./apiClient";

export async function getRewards() {
  const { data } = await apiClient.get("/rewards");
  return data;
}

export async function redeemReward(rewardId: string) {
  const { data } = await apiClient.post(`/rewards/${rewardId}/redeem`);
  return data;
}
