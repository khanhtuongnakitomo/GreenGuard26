import type { Request, Response } from 'express';
import DetectionEventModel from '../models/DetectionEvent';
import MachineModel from '../models/Machine';
import ContributionSessionModel from '../models/ContributionSession';
import UserModel from '../models/User';
import { calculateImpact, materialType, type ImpactSession } from '../services/impact';

function getRangeDate(range?: string): Date {
  const now = new Date();
  if (range === 'week') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === 'month') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  // Default: today (start of day)
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function getOverview(req: Request, res: Response) {
  const range = (req.query.range as string) || 'today';
  const since = getRangeDate(range);

  // 1. Detection aggregates
  const detections = await DetectionEventModel.find({
    capturedAt: { $gte: since }
  }).sort({ capturedAt: 1 }).lean();

  const totalDetections = detections.length;
  let nonRejects = 0;
  let totalConf = 0;
  let confidenceCount = 0;
  let totalFps = 0;
  let fpsCount = 0;
  const wasteBreakdown = {
    pet_clean: 0,
    pet_bad: 0,
    aluminum: 0
  };

  for (const d of detections) {
    if (typeof d.confidence === 'number' && Number.isFinite(d.confidence)) {
      totalConf += d.confidence;
      confidenceCount++;
    }
    if (typeof d.fps === 'number' && Number.isFinite(d.fps) && d.fps >= 0) {
      totalFps += d.fps;
      fpsCount++;
    }
    if (d.detectedType !== 'reject') {
      nonRejects++;
      if (d.detectedType in wasteBreakdown) {
        wasteBreakdown[d.detectedType as keyof typeof wasteBreakdown]++;
      }
    }
  }

  const acceptRate = totalDetections > 0 ? Number(((nonRejects / totalDetections) * 100).toFixed(1)) : null;
  const avgConfidence = confidenceCount > 0 ? Number((totalConf / confidenceCount).toFixed(2)) : null;
  const avgFps = fpsCount > 0 ? Number((totalFps / fpsCount).toFixed(1)) : null;

  const totalPet = wasteBreakdown.pet_clean + wasteBreakdown.pet_bad;
  const purityRate = totalPet > 0 ? Number(((wasteBreakdown.pet_clean / totalPet) * 100).toFixed(1)) : null;

  // 2. Machines online status
  const machines = await MachineModel.find();
  const nowTime = Date.now();
  const onlineCount = machines.filter(
    (m) => m.status === 'online' || (m.lastHeartbeatAt && nowTime - new Date(m.lastHeartbeatAt).getTime() < 60000)
  ).length;
  const binsOnline = `${onlineCount}/${machines.length}`;

  // 3. Claim status is independent of device synchronization.
  const unclaimedSessions = await ContributionSessionModel.countDocuments({ status: 'unclaimed' });

  // 4. Classification trend
  const trendMap: Record<string, number> = {};
  for (const d of detections) {
    const timeKey = new Date(d.capturedAt).toISOString().slice(0, 16);
    trendMap[timeKey] = (trendMap[timeKey] || 0) + 1;
  }

  const classificationTrend = Object.entries(trendMap)
    .slice(-12)
    .map(([label, value]) => ({ label: range === 'today' ? label.slice(11) : label.replace('T', ' '), value }));

  res.json({
    todayDetections: totalDetections,
    acceptRate,
    avgConfidence,
    binsOnline,
    avgFps,
    pendingSync: null, // Legacy field: no device queue telemetry exists here.
    unclaimedSessions,
    purityRate,
    wasteBreakdown,
    classificationTrend
  });
}

export async function getLiveFeed(req: Request, res: Response) {
  const limit = Math.min(100, req.query.limit ? Number(req.query.limit) : 50);

  const [recentDetections, recentSessions] = await Promise.all([
    DetectionEventModel.find().sort({ capturedAt: -1 }).limit(limit),
    ContributionSessionModel.find({ status: 'claimed' })
      .populate('claimedBy', 'displayName avatar')
      .populate('machineId', 'machineCode name')
      .sort({ claimedAt: -1 })
      .limit(limit)
  ]);

  const feed: Array<{
    kind: 'detection' | 'claim';
    time: string;
    machineCode: string;
    detectedType?: string;
    confidence?: number;
    decision?: 'accept' | 'reject';
    snapshotUrl?: string;
    userName?: string;
    points?: number;
    items?: Array<{ itemType: string; quantity: number }>;
  }> = [];

  for (const d of recentDetections) {
    feed.push({
      kind: 'detection',
      time: (d.capturedAt || d.createdAt || new Date()).toISOString(),
      machineCode: d.machineCode || '0001',
      detectedType: d.detectedType,
      confidence: d.confidence,
      decision: d.detectedType === 'reject' ? 'reject' : 'accept',
      snapshotUrl: d.snapshotUrl
    });
  }

  for (const s of recentSessions) {
    const user = s.claimedBy as any;
    const machine = s.machineId as any;
    feed.push({
      kind: 'claim',
      time: (s.claimedAt || s.createdAt || new Date()).toISOString(),
      machineCode: machine?.machineCode || s.machineName || '0001',
      userName: user?.displayName || 'Green User',
      points: s.totalPoints,
      items: s.items.map((i: any) => ({ itemType: i.itemType, quantity: i.quantity }))
    });
  }

  feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  res.json(feed.slice(0, limit));
}

export async function getQualityMetrics(_req: Request, res: Response) {
  const detections = await DetectionEventModel.find().sort({ capturedAt: -1 }).limit(200);

  const buckets = [
    { bucket: '0.60–0.70', min: 0.6, max: 0.7, count: 0 },
    { bucket: '0.70–0.80', min: 0.7, max: 0.8, count: 0 },
    { bucket: '0.80–0.90', min: 0.8, max: 0.9, count: 0 },
    { bucket: '0.90–1.00', min: 0.9, max: 1.01, count: 0 }
  ];

  const latencies: number[] = [];
  const fpsSeries: Array<{ time: string; fps: number }> = [];

  for (const d of detections) {
    const conf = d.confidence;
    for (const b of buckets) {
      if (conf >= b.min && conf < b.max) {
        b.count++;
        break;
      }
    }
    if (typeof d.latencyMs === 'number' && Number.isFinite(d.latencyMs) && d.latencyMs >= 0) {
      latencies.push(d.latencyMs);
    }
    if (typeof d.fps === 'number' && fpsSeries.length < 20) {
      fpsSeries.unshift({
        time: new Date(d.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fps: Number(d.fps.toFixed(1))
      });
    }
  }

  latencies.sort((a, b) => a - b);
  const latencyP50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : null;
  const latencyP95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : null;

  res.json({
    confidenceHistogram: buckets.map((b) => ({ bucket: b.bucket, count: b.count })),
    fpsSeries,
    latencyP50,
    latencyP95
  });
}

export async function getMachineLifetime(req: Request, res: Response) {
  const id = req.params.id;
  let machine = null;
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    machine = await MachineModel.findById(id);
  }
  if (!machine) {
    machine = await MachineModel.findOne({ machineCode: id });
  }

  if (!machine) {
    return res.status(404).json({ success: false, message: 'Machine not found' });
  }

  const sessions = await ContributionSessionModel.find({ machineId: machine._id })
    .populate('claimedBy', 'displayName')
    .sort({ createdAt: -1 });

  const totalItems = { pet_clean: 0, pet_bad: 0, aluminum: 0 };
  let totalPointsAwarded = 0;

  for (const s of sessions) {
    if (s.status === 'claimed') {
      totalPointsAwarded += s.totalPoints;
    }
    for (const i of s.items) {
      const type = materialType(i.itemType);
      if (type) totalItems[type] += i.quantity;
    }
  }

  const totalPet = totalItems.pet_clean + totalItems.pet_bad;
  const purityRate = totalPet > 0 ? Number(((totalItems.pet_clean / totalPet) * 100).toFixed(1)) : null;

  res.json({
    machine,
    totalSessions: sessions.length,
    totalItems,
    totalPointsAwarded,
    purityRate,
    uptimePct: null, // Requires uptime history; current status cannot measure it.
    recentSessions: sessions.slice(0, 15)
  });
}

export async function getUserLifetime(req: Request, res: Response) {
  const id = req.params.id;
  let user = null;
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    user = await UserModel.findById(id);
  }
  if (!user) {
    user = await UserModel.findOne({ phoneNumber: id });
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const totals = user.totals || { pet_clean: 0, pet_bad: 0, aluminum: 0, points: 0 };
  const totalPet = (totals.pet_clean ?? 0) + (totals.pet_bad ?? 0);
  const cleanRatio = totalPet > 0 ? Number((((totals.pet_clean ?? 0) / totalPet) * 100).toFixed(1)) : null;

  res.json({
    user,
    totals,
    lifetimePoints: user.lifetimeEarnedPoints || totals.points || 0,
    cleanRatio
  });
}

export async function getImpactMetrics(_req: Request, res: Response) {
  const claimedSessions = await ContributionSessionModel.find({ status: 'claimed' })
    .select('createdAt items').lean<ImpactSession[]>();
  res.json(calculateImpact(claimedSessions));
}

export function streamDashboardEvents(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastCheck = new Date();

  const interval = setInterval(async () => {
    try {
      const now = new Date();
      const newDetections = await DetectionEventModel.find({ capturedAt: { $gt: lastCheck } }).sort({ capturedAt: -1 }).limit(5);
      const newClaims = await ContributionSessionModel.find({ claimedAt: { $gt: lastCheck }, status: 'claimed' })
        .populate('claimedBy', 'displayName')
        .sort({ claimedAt: -1 })
        .limit(5);

      lastCheck = now;

      for (const d of newDetections) {
        res.write(`data: ${JSON.stringify({ type: 'detection', data: d })}\n\n`);
      }
      for (const c of newClaims) {
        res.write(`data: ${JSON.stringify({ type: 'claim', data: c })}\n\n`);
      }
    } catch {
      // Ignored during connection drop
    }
  }, 2500);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}
