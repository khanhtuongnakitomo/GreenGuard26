import { Router } from 'express';
import { receiveHeartbeat, getMachine } from '../controllers/machine.controller';

const router = Router();

// POST /api/machines/heartbeat          — Jetson gửi heartbeat (PHẢI TRƯỚC /:machineId)
router.post('/heartbeat', receiveHeartbeat);

// GET  /api/machines/:machineId         — Dashboard lấy trạng thái machine
router.get('/:machineId', getMachine);

export default router;
