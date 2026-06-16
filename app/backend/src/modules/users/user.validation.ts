import { z } from "zod";

export const updateMeSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).optional(),
    avatarUrl: z.string().url().optional(),
    faculty: z.string().optional(),
    className: z.string().optional(),
    studentId: z.string().optional(),
    notificationSettings: z
      .object({
        rewardUpdates: z.boolean().optional(),
        campaignUpdates: z.boolean().optional(),
        milestoneUpdates: z.boolean().optional()
      })
      .optional()
  })
});
