import { z } from "zod";

export const voucherIdSchema = z.object({
  params: z.object({ voucherId: z.string().min(1) })
});

export const validateVoucherSchema = z.object({
  body: z.object({
    redeemCode: z.string().min(1).optional(),
    qrToken: z.string().min(1).optional()
  })
});

export const useVoucherSchema = z.object({
  body: z.object({
    redeemCode: z.string().min(1).optional(),
    qrToken: z.string().min(1).optional(),
    usedLocation: z.string().min(1).optional()
  })
});
