import { Request, Response } from 'express';
import { DemoDetectedType, DemoSessionMode, recordDemoDetection, sessionSummary, SESSION_TIMEOUT_MS } from '../services/demoSession';
import { projectDetection } from '../services/publicProjection';

const ALLOWED_TYPES = new Set<DemoDetectedType>(['pet_clean', 'pet_bad', 'aluminum']);

function optionalNonNegativeNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('must be a non-negative number');
  return parsed;
}

export const ingestDemoDetection = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = String(req.body?.eventId ?? '').trim();
    const machineCode = String(req.body?.machineCode ?? '').trim();
    const detectedType = String(req.body?.detectedType ?? '') as DemoDetectedType;
    const confidence = Number(req.body?.confidence);
    const sessionMode = String(req.body?.sessionMode ?? 'inactivity') as DemoSessionMode;
    if (!eventId || !machineCode) {
      res.status(400).json({ success: false, message: 'eventId and machineCode are required' });
      return;
    }
    if (!ALLOWED_TYPES.has(detectedType)) {
      res.status(400).json({ success: false, message: 'detectedType is not supported' });
      return;
    }
    if (sessionMode !== 'manual' && sessionMode !== 'inactivity') {
      res.status(400).json({ success: false, message: 'sessionMode must be manual or inactivity' });
      return;
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      res.status(400).json({ success: false, message: 'confidence must be between 0 and 1' });
      return;
    }
    const capturedAt = req.body?.capturedAt ? new Date(req.body.capturedAt) : undefined;
    if (capturedAt && Number.isNaN(capturedAt.getTime())) {
      res.status(400).json({ success: false, message: 'capturedAt must be a valid date' });
      return;
    }

    let fps: number | undefined;
    let latencyMs: number | undefined;
    try {
      fps = optionalNonNegativeNumber(req.body?.fps);
      latencyMs = optionalNonNegativeNumber(req.body?.latencyMs);
    } catch (error) {
      res.status(400).json({ success: false, message: (error as Error).message });
      return;
    }

    const result = await recordDemoDetection({
      eventId,
      machineCode,
      detectedType,
      confidence,
      fps,
      latencyMs,
      capturedAt,
      sessionMode,
    });
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      event: projectDetection(result.event),
      session: sessionSummary(result.session),
      sessionTimeoutMs: SESSION_TIMEOUT_MS,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
