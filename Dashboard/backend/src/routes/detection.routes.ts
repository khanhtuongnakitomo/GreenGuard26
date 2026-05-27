import { Router } from 'express';
import {
  createDetection,
  getDetections,
  getLatestDetection,
} from '../controllers/detection.controller';

const router = Router();

// POST   /api/detections           — Jetson gửi event lên
router.post('/', createDetection);

// GET    /api/detections/latest    — Dashboard lấy event mới nhất (PHẢI TRƯỚC /:id nếu có)
router.get('/latest', getLatestDetection);

// GET    /api/detections           — Dashboard lấy lịch sử + filter
router.get('/', getDetections);

export default router;
