import { Request, Response } from 'express';
import { Detection } from '../models/Detection';
import type { CreateDetectionDto } from '../types';

// ─── POST /api/detections ────────────────────────────────────────────────────
// Jetson gửi detection event lên backend (idempotent qua eventId unique index)
export const createDetection = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate body trước khi upsert
  const body = req.body as CreateDetectionDto;

  try {
    // Dùng upsert để idempotent: Jetson retry không tạo duplicate
    await Detection.findOneAndUpdate(
      { eventId: body.eventId },
      {
        ...body,
        createdAt: new Date(body.createdAt),
        serverReceivedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Detection event saved',
      eventId: body.eventId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ─── GET /api/detections ────────────────────────────────────────────────────
// Dashboard lấy lịch sử phân loại, hỗ trợ filter + pagination
export const getDetections = async (req: Request, res: Response): Promise<void> => {
  const {
    machineId,
    detectedType,
    sortingStatus,
    startDate,
    endDate,
    limit = '50',
    offset = '0',
  } = req.query;

  try {
    // TODO: Build filter object từ query params
    const filter: Record<string, unknown> = {};
    if (machineId)     filter.machineId = machineId;
    if (detectedType)  filter.detectedType = detectedType;
    if (sortingStatus) filter.sortingStatus = sortingStatus;
    if (startDate || endDate) {
      filter.createdAt = {
        ...(startDate ? { $gte: new Date(startDate as string) } : {}),
        ...(endDate   ? { $lte: new Date(endDate as string) }   : {}),
      };
    }

    const [data, total] = await Promise.all([
      Detection.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean(),
      Detection.countDocuments(filter),
    ]);

    res.json({ data, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

// ─── GET /api/detections/latest ─────────────────────────────────────────────
// Dashboard lấy event mới nhất (polling 3s)
export const getLatestDetection = async (req: Request, res: Response): Promise<void> => {
  const { machineId } = req.query;

  try {
    const filter: Record<string, unknown> = {};
    if (machineId) filter.machineId = machineId;

    const latest = await Detection.findOne(filter).sort({ createdAt: -1 }).lean();
    res.json(latest ?? null);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};
