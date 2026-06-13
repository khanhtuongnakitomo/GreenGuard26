import { connectDb } from "../config/db";
import { seedMachines } from "./seedMachines";
import { seedPartners } from "./seedPartners";
import { seedRewards } from "./seedRewards";
import { seedUsers } from "./seedUsers";
import { seedMilestones } from "./seedMilestones";

async function run() {
  const connection = await connectDb();
  await seedUsers();
  await seedPartners();
  await seedRewards();
  await seedMachines();
  await seedMilestones();
  await connection.close();
  console.log("GreenPoint seed data created");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
