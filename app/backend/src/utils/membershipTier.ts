const TIER_THRESHOLDS = [
  { tier: "platinum", minItems: 100 },
  { tier: "gold", minItems: 50 },
  { tier: "silver", minItems: 20 },
  { tier: "green_member", minItems: 0 }
] as const;

export function calculateMembershipTier(totalItems: number): "green_member" | "silver" | "gold" | "platinum" {
  for (const { tier, minItems } of TIER_THRESHOLDS) {
    if (totalItems >= minItems) return tier;
  }
  return "green_member";
}
