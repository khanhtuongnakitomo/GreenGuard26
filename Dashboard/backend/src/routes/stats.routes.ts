import { Router } from 'express';
import { getSummary } from '../controllers/stats.controller';

const router = Router();

// GET /api/stats/summary?machineCode=0001
router.get('/summary', getSummary);

export default router;
