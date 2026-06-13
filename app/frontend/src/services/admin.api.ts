import { apiClient } from "./apiClient";

export async function getAdminOverview() {
  const { data } = await apiClient.get("/admin/overview");
  return data;
}
