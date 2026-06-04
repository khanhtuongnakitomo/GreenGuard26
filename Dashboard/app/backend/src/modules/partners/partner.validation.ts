import { z } from "zod";

export const partnerIdSchema = z.object({
  params: z.object({ partnerId: z.string().min(1) })
});

export const createPartnerSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    type: z.enum(["university", "brand", "retailer", "canteen", "parking"]),
    logoUrl: z.string().url().optional(),
    description: z.string().optional()
  })
});

export const updatePartnerSchema = z.object({
  params: z.object({ partnerId: z.string().min(1) }),
  body: createPartnerSchema.shape.body.partial().extend({
    status: z.enum(["active", "inactive"]).optional()
  })
});
