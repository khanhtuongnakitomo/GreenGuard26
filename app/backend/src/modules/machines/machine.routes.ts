import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import * as controller from "./machine.controller";
import { createMachineSchema, machineIdSchema, updateMachineSchema, heartbeatSchema } from "./machine.validation";

export const machineRoutes = Router();

machineRoutes.use(authMiddleware);
machineRoutes.get("/", requireRole("admin"), controller.getMachines);
machineRoutes.get("/:machineId", requireRole("admin"), validate(machineIdSchema), controller.getMachineById);
machineRoutes.post("/", requireRole("admin"), validate(createMachineSchema), controller.createMachine);
machineRoutes.patch("/:machineId", requireRole("admin"), validate(updateMachineSchema), controller.updateMachine);
machineRoutes.post("/:machineId/heartbeat", requireRole("admin", "operator"), validate(heartbeatSchema), controller.machineHeartbeat);
