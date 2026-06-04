import { z } from "zod";

export const createMilestoneSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    conditionType: z.enum(["total_items", "total_bottles", "total_cans", "streak", "monthly_points"]),
    targetValue: z.number().int().min(1),
    rewardPoints: z.number().int().min(0).default(0),
    badgeIcon: z.string().optional()
  })
});

export const updateMilestoneSchema = z.object({
  params: z.object({ milestoneId: z.string().min(1) }),
  body: createMilestoneSchema.shape.body.partial().extend({
    status: z.enum(["active", "inactive"]).optional()
  })
});
