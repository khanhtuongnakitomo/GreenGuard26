import { apiClient } from "./apiClient";
import type { ContributionItem } from "../types/contribution.types";

export async function createContributionSession(machineCode: string, machineApiKey: string, items: ContributionItem[]) {
  const { data } = await apiClient.post(
    "/contributions",
    { machineCode, items },
    { headers: { "x-machine-api-key": machineApiKey } }
  );
  return data;
}

export async function claimContribution(claimToken: string) {
  const { data } = await apiClient.post("/contributions/claim", { claimToken });
  return data;
}
