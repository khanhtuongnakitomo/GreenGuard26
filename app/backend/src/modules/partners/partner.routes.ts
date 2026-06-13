import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./partner.controller";
import { partnerIdSchema } from "./partner.validation";

export const partnerRoutes = Router();

partnerRoutes.get("/", controller.getPartners);
partnerRoutes.get("/:partnerId", validate(partnerIdSchema), controller.getPartnerById);
