import { apiClient } from "./apiClient";

export async function getMySummary() {
  const { data } = await apiClient.get("/users/me/summary");
  return data;
}

export async function getMyImpact() {
  const { data } = await apiClient.get("/users/me/impact");
  return data;
}

export async function getMyHistory() {
  const { data } = await apiClient.get("/users/me/history");
  return data;
}
