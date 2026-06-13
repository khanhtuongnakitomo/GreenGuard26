import { z } from "zod";

export const createCampaignSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    bonusMultiplier: z.number().min(1).default(1)
  })
});

export const updateCampaignSchema = z.object({
  params: z.object({ campaignId: z.string().min(1) }),
  body: createCampaignSchema.shape.body.partial().extend({
    status: z.enum(["active", "inactive", "ended"]).optional()
  })
});

export const campaignIdSchema = z.object({
  params: z.object({ campaignId: z.string().min(1) })
});
