import { Router } from 'express';
import { getMachines, getMachine } from '../controllers/machine.controller';

const router: Router = Router();

// GET  /api/machines                    — Dashboard lấy danh sách machine
router.get('/', getMachines);

// GET  /api/machines/:machineCode       — Dashboard lấy trạng thái machine
router.get('/:machineCode', getMachine);

export default router;
