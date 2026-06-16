import { PartnerModel } from "../modules/partners/partner.model";

export async function seedPartners() {
  const partners = [
    { name: "DHBK", type: "university", description: "University services" },
    { name: "CocaCola", type: "brand", description: "Beverage campaigns" },
    { name: "AquaFina", type: "brand", description: "Free drink rewards" },
    { name: "Circle K", type: "retailer", description: "Retail redemption partner" }
  ];

  for (const partner of partners) {
    await PartnerModel.updateOne({ name: partner.name }, partner, { upsert: true });
  }
}
