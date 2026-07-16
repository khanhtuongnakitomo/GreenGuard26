import { MachineModel } from "../modules/machines/machine.model";
import { hashApiKey } from "../utils/hash";

export async function seedMachines() {
  await MachineModel.updateOne(
    { machineCode: "0001" },
    {
      machineCode: "0001",
      name: "Smart Bin H1",
      locationName: "DHBK Main Hall",
      locationType: "classroom_area",
      apiKeyHash: await hashApiKey("machine-demo-key"),
      status: "online",
      lastSeenAt: new Date()
    },
    { upsert: true }
  );
}
