import { compareApiKey, hashApiKey } from "../../utils/hash";
import { HttpError } from "../../utils/httpError";
import { generateMachineCode } from "../../utils/generateCode";
import { MachineModel } from "./machine.model";

export async function createMachine(input: {
  machineCode?: string;
  name?: string;
  locationName: string;
  locationType: string;
  apiKey: string;
}) {
  return MachineModel.create({
    machineCode: input.machineCode || generateMachineCode(),
    name: input.name,
    locationName: input.locationName,
    locationType: input.locationType,
    apiKeyHash: await hashApiKey(input.apiKey),
    status: "offline"
  });
}

export async function getMachines() {
  return MachineModel.find().sort({ createdAt: -1 });
}

export async function getMachineById(machineId: string) {
  const machine = await MachineModel.findById(machineId);
  if (!machine) throw new HttpError(404, "Machine not found");
  return machine;
}

export async function updateMachine(machineId: string, patch: Record<string, unknown>) {
  const machine = await MachineModel.findByIdAndUpdate(machineId, patch, { new: true, runValidators: true });
  if (!machine) throw new HttpError(404, "Machine not found");
  return machine;
}

export async function updateMachineHeartbeat(
  machineId: string,
  bins?: Array<{ binType: string; capacityPercent: number }>
) {
  const update: any = { status: "online", lastSeenAt: new Date() };
  if (bins) update.bins = bins;
  
  const machine = await MachineModel.findByIdAndUpdate(machineId, update, { new: true });
  if (!machine) throw new HttpError(404, "Machine not found");
  return machine;
}

export async function validateMachineApiKey(machineCode: string, apiKey: string) {
  const machine = await MachineModel.findOne({ machineCode }).select("+apiKeyHash");
  if (!machine || machine.status === "disabled") throw new HttpError(401, "Invalid machine credentials");
  const valid = await compareApiKey(apiKey, machine.apiKeyHash);
  if (!valid) throw new HttpError(401, "Invalid machine credentials");
  return machine;
}
