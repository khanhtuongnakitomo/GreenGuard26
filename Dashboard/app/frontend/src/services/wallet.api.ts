import { apiClient } from "./apiClient";

export async function getWallet() {
  const { data } = await apiClient.get("/wallet");
  return data;
}
