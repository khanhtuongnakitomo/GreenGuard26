export type ContributionItem = {
  itemType: "plastic_bottle" | "can";
  quantity: number;
};

export type ContributionSessionResponse = {
  session: {
    _id: string;
    sessionCode: string;
    totalPoints: number;
    expiresAt: string;
  };
  claimToken: string;
};
