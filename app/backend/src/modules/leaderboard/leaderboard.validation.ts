import { z } from "zod";

export const periodQuerySchema = z.object({
  query: z.object({
    period: z.enum(["week", "month", "year", "all"]).default("month")
  })
});
