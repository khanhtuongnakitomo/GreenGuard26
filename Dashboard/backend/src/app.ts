import express from 'express';
import cors from 'cors';
import sessionRoutes from './routes/session.routes';
import machineRoutes   from './routes/machine.routes';
import statsRoutes     from './routes/stats.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/sessions',   sessionRoutes);
app.use('/api/machines',   machineRoutes);
app.use('/api/stats',      statsRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

export default app;
