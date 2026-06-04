import { z } from "zod";

export const rewardIdSchema = z.object({
  params: z.object({ rewardId: z.string().min(1) })
});

export const createRewardSchema = z.object({
  body: z.object({
    partnerId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    rewardType: z.enum(["parking_ticket", "meal_voucher", "promo_code", "free_item", "discount"]),
    pointsRequired: z.number().int().min(0),
    valueVnd: z.number().min(0).optional(),
    quantityTotal: z.number().int().min(0).optional(),
    quantityRemaining: z.number().int().min(0).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    terms: z.array(z.string()).default([])
  })
});

export const updateRewardSchema = z.object({
  params: z.object({ rewardId: z.string().min(1) }),
  body: createRewardSchema.shape.body.partial().extend({
    status: z.enum(["active", "inactive", "expired"]).optional()
  })
});
