import { z } from "zod";
import { ITEM_TYPES } from "../../types/enums";

export const createContributionSchema = z.object({
  body: z.object({
    machineCode: z.string().min(1),
    claimToken: z.string().min(1),
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
    claimToken: z.string().min(1),
    /** Full QR JSON string — used to create the session if machine POST was missed/late */
    rawQr: z.string().min(1).optional()
  })
});

export const contributionIdSchema = z.object({
  params: z.object({ sessionId: z.string().min(1) })
});
