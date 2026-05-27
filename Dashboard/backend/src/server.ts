import 'dotenv/config';
import app from './app';
import connectDB from './config/db';

const PORT = process.env.PORT ?? 3001;

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
    console.log(`[Server] Env: ${process.env.NODE_ENV ?? 'development'}`);
  });
};

start();
