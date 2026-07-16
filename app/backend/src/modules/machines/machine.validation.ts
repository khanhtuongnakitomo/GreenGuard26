import { z } from "zod";

export const createMachineSchema = z.object({
  body: z.object({
    machineCode: z.string().min(3).optional(),
    name: z.string().min(1),
    locationName: z.string().min(1),
    locationType: z.enum(["canteen", "parking", "library", "classroom_area", "other"]).default("other"),
    apiKey: z.string().min(8),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});

export const updateMachineSchema = z.object({
  params: z.object({ machineId: z.string().min(1) }),
  body: z.object({
    name: z.string().optional(),
    locationName: z.string().optional(),
    locationType: z.enum(["canteen", "parking", "library", "classroom_area", "other"]).optional(),
    status: z.enum(["online", "offline", "maintenance", "disabled"]).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});

export const machineIdSchema = z.object({
  params: z.object({ machineId: z.string().min(1) })
});

export const heartbeatSchema = z.object({
  params: z.object({ machineId: z.string().min(1) }),
  body: z.object({
    bins: z.array(z.object({
      binType: z.enum(["plastic_bottle", "can", "carton"]),
      capacityPercent: z.number().min(0).max(100)
    })).optional()
  }).optional()
});
