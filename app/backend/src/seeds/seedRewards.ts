import { PartnerModel } from "../modules/partners/partner.model";
import { RewardModel } from "../modules/rewards/reward.model";

export async function seedRewards() {
  const dhbk = await PartnerModel.findOne({ name: "DHBK" });
  const coke = await PartnerModel.findOne({ name: "CocaCola" });
  const aqua = await PartnerModel.findOne({ name: "AquaFina" });
  if (!dhbk || !coke || !aqua) throw new Error("Partners must be seeded before rewards");

  const rewards = [
    {
      partnerId: dhbk._id,
      name: "Digital parking ticket",
      rewardType: "parking_ticket",
      pointsRequired: 2000,
      quantityTotal: 100,
      quantityRemaining: 86,
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      terms: ["Valid for one motorbike parking entry."]
    },
    {
      partnerId: dhbk._id,
      name: "Lunch voucher",
      rewardType: "meal_voucher",
      pointsRequired: 35000,
      quantityTotal: 50,
      quantityRemaining: 44,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    },
    {
      partnerId: coke._id,
      name: "Promo code",
      rewardType: "promo_code",
      pointsRequired: 800,
      quantityTotal: 200,
      quantityRemaining: 153,
      validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
    },
    {
      partnerId: aqua._id,
      name: "Free drink at Circle K",
      rewardType: "free_item",
      pointsRequired: 1200,
      quantityTotal: 160,
      quantityRemaining: 112,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  ];

  for (const reward of rewards) {
    await RewardModel.updateOne({ partnerId: reward.partnerId, name: reward.name }, reward, { upsert: true });
  }
}
