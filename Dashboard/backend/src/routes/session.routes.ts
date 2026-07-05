import { Router } from 'express';
import {
  getSessions,
  getLatestSession,
} from '../controllers/session.controller';

const router = Router();

// GET    /api/sessions/latest    — Dashboard lấy event mới nhất (PHẢI TRƯỚC /:id nếu có)
router.get('/latest', getLatestSession);

// GET    /api/sessions           — Dashboard lấy lịch sử + filter
router.get('/', getSessions);

export default router;
