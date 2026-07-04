import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateContributionItems, getPointsPerItem } from "./pointRules";

describe("pointRules", () => {
  it("returns the configured points for supported item types", () => {
    assert.equal(getPointsPerItem("plastic_bottle"), 10);
    assert.equal(getPointsPerItem("can"), 8);
    assert.equal(getPointsPerItem("carton"), 6);
  });

  it("normalizes contribution items and calculates the total points", () => {
    const result = calculateContributionItems([
      { itemType: "plastic_bottle", quantity: 3 },
      { itemType: "can", quantity: 2 },
      { itemType: "carton", quantity: 1 }
    ]);

    assert.deepEqual(result, {
      items: [
        { itemType: "plastic_bottle", quantity: 3, pointsPerItem: 10 },
        { itemType: "can", quantity: 2, pointsPerItem: 8 },
        { itemType: "carton", quantity: 1, pointsPerItem: 6 }
      ],
      totalPoints: 52
    });
  });
});
