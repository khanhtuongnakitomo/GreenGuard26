export type Partner = {
  _id: string;
  name: string;
  type: string;
  logoUrl?: string;
  description?: string;
  status: string;
};

export type Reward = {
  _id: string;
  partnerId: Partner;
  name: string;
  description?: string;
  rewardType: string;
  pointsRequired: number;
  quantityRemaining?: number;
  validUntil?: string;
  terms?: string[];
  status: string;
};
