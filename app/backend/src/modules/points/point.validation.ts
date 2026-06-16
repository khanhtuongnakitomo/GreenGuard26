import { z } from "zod";

export const adminAdjustPointsSchema = z.object({
  params: z.object({ userId: z.string().min(1) }),
  body: z.object({
    points: z.number().int(),
    description: z.string().min(1)
  })
});
