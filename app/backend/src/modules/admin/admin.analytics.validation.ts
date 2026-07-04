import { z } from "zod";

export const analyticsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    period: z.enum(["daily", "weekly", "monthly"]).optional()
  })
});
