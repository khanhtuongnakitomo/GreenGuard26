import { z } from "zod";
import { ITEM_TYPES } from "../../types/enums";

export const createContributionSchema = z.object({
  body: z.object({
    machineCode: z.string().min(1),
    items: z.array(
      z.object({
        itemType: z.enum(ITEM_TYPES),
        quantity: z.number().int().min(1)
      })
    ).min(1)
  })
});

export const claimContributionSchema = z.object({
  body: z.object({
    claimToken: z.string().min(1)
  })
});

export const contributionIdSchema = z.object({
  params: z.object({ sessionId: z.string().min(1) })
});
