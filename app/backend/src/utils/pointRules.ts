import { POINT_RULES } from "../config/constants";
import type { ItemType } from "../types/enums";

export type ContributionItemInput = {
  itemType: ItemType;
  quantity: number;
};

export function getPointsPerItem(itemType: ItemType) {
  return POINT_RULES[itemType];
}

export function calculateContributionItems(items: ContributionItemInput[]) {
  const normalized = items.map((item) => ({
    ...item,
    pointsPerItem: getPointsPerItem(item.itemType)
  }));

  const totalPoints = normalized.reduce((sum, item) => sum + item.quantity * item.pointsPerItem, 0);
  return { items: normalized, totalPoints };
}
