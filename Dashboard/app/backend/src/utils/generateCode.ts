import { customAlphabet } from "nanoid";

const code = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

export function generateSessionCode() {
  return `SESSION-${code()}`;
}

export function generateRedeemCode() {
  return `GP-${code()}`;
}

export function generateMachineCode() {
  return `MACHINE-${code()}`;
}

export function generateCampaignCode() {
  return `CAMPAIGN-${code()}`;
}
