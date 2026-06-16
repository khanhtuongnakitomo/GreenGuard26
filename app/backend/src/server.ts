import { env } from "./config/env";
import { connectDb } from "./config/db";
import { app } from "./app";

async function bootstrap() {
  await connectDb();
  app.listen(env.PORT, () => {
    console.log(`GreenPoint API running on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start GreenPoint API", error);
  process.exit(1);
});
