import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./voucher.controller";
import { voucherIdSchema } from "./voucher.validation";

export const voucherRoutes = Router();

voucherRoutes.use(authMiddleware);
voucherRoutes.get("/", controller.getMyVouchers);
voucherRoutes.get("/:voucherId", validate(voucherIdSchema), controller.getVoucherDetail);
