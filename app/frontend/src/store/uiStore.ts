import { create } from "zustand";

type UiState = {
  activeRewardPartner: string;
  setActiveRewardPartner: (partner: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeRewardPartner: "all",
  setActiveRewardPartner: (partner) => set({ activeRewardPartner: partner })
}));
