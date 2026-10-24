import dotenv from 'dotenv';
import path from 'path';
import app from './app';
import connectDB from './config/db';
import { resumeCollectingSessions } from './services/demoSession';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT ?? 3001;
const HOST = process.env.HOST ?? '127.0.0.1';

const start = async (): Promise<void> => {
  await connectDB();
  await resumeCollectingSessions();
  app.listen(Number(PORT), HOST, () => {
    console.log(`[Server] Running at http://${HOST}:${PORT}`);
    console.log(`[Server] Env: ${process.env.NODE_ENV ?? 'development'}`);
  });
};

start();
