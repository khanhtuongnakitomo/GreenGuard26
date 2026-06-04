import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./contribution.controller";
import { claimContributionSchema, contributionIdSchema, createContributionSchema } from "./contribution.validation";

export const contributionRoutes = Router();

contributionRoutes.post("/", validate(createContributionSchema), controller.createContributionSession);
contributionRoutes.post("/claim", authMiddleware, validate(claimContributionSchema), controller.claimContributionSession);
contributionRoutes.get("/", authMiddleware, requireRole("admin"), controller.listContributions);
contributionRoutes.get("/:sessionId", authMiddleware, validate(contributionIdSchema), controller.getContributionSession);
