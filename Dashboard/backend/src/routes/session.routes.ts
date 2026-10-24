import { Router } from 'express';
import {
  finalizeCurrentSession,
  getSessions,
  getLatestSession,
} from '../controllers/session.controller';

const router: Router = Router();

// GET    /api/sessions/latest    — Dashboard lấy event mới nhất (PHẢI TRƯỚC /:id nếu có)
router.get('/latest', getLatestSession);
router.post('/finalize', finalizeCurrentSession);

// GET    /api/sessions           — Dashboard lấy lịch sử + filter
router.get('/', getSessions);

export default router;
