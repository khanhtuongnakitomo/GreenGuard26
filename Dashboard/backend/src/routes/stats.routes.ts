import { Router } from 'express';
import { getSummary } from '../controllers/stats.controller';

const router = Router();

// GET /api/stats/summary?machineId=BK_BIN_01
router.get('/summary', getSummary);

export default router;
