import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./operator.controller";
import { useVoucherSchema, validateVoucherSchema } from "./operator.validation";

export const operatorRoutes = Router();

operatorRoutes.use(authMiddleware, requireRole("operator", "admin"));
operatorRoutes.post("/vouchers/validate", validate(validateVoucherSchema), controller.validateVoucher);
operatorRoutes.post("/vouchers/use", validate(useVoucherSchema), controller.useVoucher);
operatorRoutes.get("/history", controller.getOperatorHistory);
