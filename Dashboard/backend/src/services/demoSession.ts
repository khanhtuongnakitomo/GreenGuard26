import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import ContributionSessionModel from '../models/ContributionSession';
import DetectionEventModel from '../models/DetectionEvent';
import MachineModel from '../models/Machine';
import { projectSession } from './publicProjection';

export type DemoDetectedType = 'pet_clean' | 'pet_bad' | 'aluminum';
export type DemoSessionMode = 'manual' | 'inactivity';

export interface DemoDetectionInput {
  eventId: string;
  machineCode: string;
  detectedType: DemoDetectedType;
  confidence: number;
  fps?: number;
  latencyMs?: number;
  capturedAt?: Date;
  sessionMode?: DemoSessionMode;
}

export const POINTS_PER_ITEM: Record<DemoDetectedType, number> = {
  pet_clean: 10,
  pet_bad: 5,
  aluminum: 8,
};

export const SESSION_TIMEOUT_MS = 10_000;
const QR_EXPIRY_MS = 15 * 60 * 1000;
const timers = new Map<string, NodeJS.Timeout>();
const finalizationLocks = new Map<string, Promise<any | null>>();

function getQrSecret(): string {
  // Development/test fallback matches GreenPoint's local default. Production
  // startup is guarded by run-dashboard.ps1 and must provide QR_SECRET.
  const secret = String(
    process.env.QR_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dev_qr_signing_secret_1234567890'),
  ).trim();
  if (secret.length < 16) {
    throw new Error('QR_SECRET must be configured with at least 16 characters');
  }
  return secret;
}

function generateClaimToken(): string {
  return `GP-CLAIM-${randomBytes(12).toString('hex').toUpperCase()}`;
}

function hashClaimToken(claimToken: string): string {
  return createHash('sha256').update(claimToken).digest('hex');
}

export function generateSessionCode(now = new Date()): string {
  const time = now.getTime().toString(36).toUpperCase();
  return `DEMO-${time}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/** Build the exact signed payload consumed by GreenPoint's QR scanner. */
export function buildQrPayload(session: {
  claimToken: string;
  machineCode?: string;
  totalItems: number;
  totalPoints: number;
  items: Array<{ itemType: string; quantity: number }>;
  expiresAt: Date;
}): string {
  const payload: Record<string, unknown> = {
    claimToken: session.claimToken,
    totalItems: session.totalItems,
    totalPoints: session.totalPoints,
    items: session.items.map(({ itemType, quantity }) => ({ itemType, quantity })),
    expiresAt: session.expiresAt.toISOString(),
  };
  if (session.machineCode !== undefined) payload.machineCode = session.machineCode;
  const signature = createHmac('sha256', getQrSecret())
    .update(JSON.stringify(payload))
    .digest('hex');
  return JSON.stringify({ ...payload, signature });
}

function cancelTimer(machineCode: string): void {
  const timer = timers.get(machineCode);
  if (timer) clearTimeout(timer);
  timers.delete(machineCode);
}

function scheduleFinalization(machineCode: string, sessionId: string, delayMs: number): void {
  cancelTimer(machineCode);
  const timer = setTimeout(() => {
    timers.delete(machineCode);
    void finalizeSession(sessionId).catch((error) => {
      console.error('[DemoSession] Failed to finalize session:', (error as Error).message);
    });
  }, Math.max(0, delayMs));
  timer.unref?.();
  timers.set(machineCode, timer);
}

function sessionModeOf(session: any): DemoSessionMode {
  return session?.finalizationMode === 'manual' ? 'manual' : 'inactivity';
}

function hasItems(session: any): boolean {
  return Number(session?.totalItems ?? 0) > 0 && Array.isArray(session?.items) && session.items.length > 0;
}

function normalizeSessionPoints(session: any): void {
  for (const item of session.items ?? []) {
    const points = POINTS_PER_ITEM[item.itemType as DemoDetectedType];
    if (points !== undefined) item.pointsPerItem = points;
  }
  session.totalPoints = (session.items ?? []).reduce(
    (sum: number, item: any) => sum + Number(item.quantity ?? 0) * Number(item.pointsPerItem ?? 0),
    0,
  );
}

export function sessionSummary(session: any, now = new Date()): any {
  if (!session) return null;
  const row = typeof session.toObject === 'function' ? session.toObject() : session;
  const summary = projectSession(row)!;
  summary.timeoutAt = row.status === 'collecting' && row.finalizationMode !== 'manual' && row.lastDetectionAt
    ? new Date(new Date(row.lastDetectionAt).getTime() + SESSION_TIMEOUT_MS).toISOString()
    : null;
  // Only the current demo session endpoints carry an actionable QR; historical
  // lists and event streams continue to use the public projection without it.
  if (row.status === 'unclaimed' && new Date(row.expiresAt).getTime() > now.getTime() && typeof row.qrPayload === 'string') {
    summary.qrPayload = row.qrPayload;
  }
  return summary;
}

export async function finalizeSession(sessionId: string, now = new Date(), force = false): Promise<any | null> {
  const session: any = await ContributionSessionModel.findOne({ _id: sessionId, status: 'collecting' });
  if (!session || !hasItems(session)) return null;

  const lastDetectionAt = new Date(session.lastDetectionAt ?? session.createdAt);
  const remaining = lastDetectionAt.getTime() + SESSION_TIMEOUT_MS - now.getTime();
  if (!force && sessionModeOf(session) !== 'manual' && remaining > 0) {
    scheduleFinalization(String(session.machineCode), String(session._id), remaining);
    return null;
  }

  const closedAt = now;
  const expiresAt = new Date(closedAt.getTime() + QR_EXPIRY_MS);
  normalizeSessionPoints(session);
  const claimToken = generateClaimToken();
  session.status = 'unclaimed';
  session.closedAt = closedAt;
  session.expiresAt = expiresAt;
  session.claimTokenHash = hashClaimToken(claimToken);
  session.qrPayload = buildQrPayload({
    claimToken,
    machineCode: session.machineCode,
    totalItems: session.totalItems,
    totalPoints: session.totalPoints,
    items: session.items,
    expiresAt,
  });
  await session.save();
  cancelTimer(String(session.machineCode));
  await MachineModel.findByIdAndUpdate(session.machineId, {
    $inc: { totalSessions: 1 },
    $set: { status: 'online', lastSeenAt: closedAt, lastHeartbeatAt: closedAt },
  });
  return session;
}

async function findOrCreateCollectingSession(
  machine: any,
  now: Date,
  requestedMode: DemoSessionMode,
): Promise<any> {
  let session: any = await ContributionSessionModel.findOne({ machineId: machine._id, status: 'collecting' });
  if (session) {
    const lastDetectionAt = new Date(session.lastDetectionAt ?? session.createdAt);
    if (
      sessionModeOf(session) !== 'manual' &&
      requestedMode === 'inactivity' &&
      now.getTime() - lastDetectionAt.getTime() >= SESSION_TIMEOUT_MS
    ) {
      await finalizeSession(String(session._id), now);
      session = null;
    }
  }
  if (session) {
    if (requestedMode === 'manual' && sessionModeOf(session) !== 'manual') {
      session.finalizationMode = 'manual';
      normalizeSessionPoints(session);
      await session.save();
      cancelTimer(String(machine.machineCode));
    }
    return session;
  }

  return ContributionSessionModel.create({
    sessionCode: generateSessionCode(now),
    machineId: machine._id,
    machineCode: machine.machineCode,
    machineName: machine.name,
    items: [],
    totalItems: 0,
    totalPoints: 0,
    status: 'collecting',
    finalizationMode: requestedMode,
    lastDetectionAt: now,
    expiresAt: new Date(now.getTime() + QR_EXPIRY_MS),
  });
}

export async function recordDemoDetection(input: DemoDetectionInput): Promise<{
  event: any;
  session: any;
  duplicate: boolean;
}> {
  const existing: any = await DetectionEventModel.findOne({ eventId: input.eventId });
  if (existing) {
    const session = existing.sessionCode
      ? await ContributionSessionModel.findOne({ sessionCode: existing.sessionCode })
      : null;
    return { event: existing, session, duplicate: true };
  }

  const now = new Date();
  const machine: any = await MachineModel.findOneAndUpdate(
    { machineCode: input.machineCode },
    {
      $set: { status: 'online', lastSeenAt: now, lastHeartbeatAt: now },
      $setOnInsert: {
        name: `GreenGuard Demo ${input.machineCode}`,
        locationName: 'Demo laptop',
        locationType: 'other',
        totalSessions: 0,
        bins: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const requestedMode = input.sessionMode ?? 'inactivity';
  const session: any = await findOrCreateCollectingSession(machine, now, requestedMode);
  let event: any;
  try {
    event = await DetectionEventModel.create({
      ...input,
      sessionMode: undefined,
      machineId: machine._id,
      machineCode: machine.machineCode,
      sessionCode: session.sessionCode,
      sortingStatus: 'sorted',
      syncStatus: 'synced',
      capturedAt: input.capturedAt ?? now,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    event = await DetectionEventModel.findOne({ eventId: input.eventId });
    return { event, session, duplicate: true };
  }

  const item = session.items.find((candidate: any) => candidate.itemType === input.detectedType);
  if (item) {
    const nextQuantity = item.quantity + 1;
    item.avgConfidence = Number(
      (((item.avgConfidence ?? 0) * item.quantity + input.confidence) / nextQuantity).toFixed(4),
    );
    item.quantity = nextQuantity;
  } else {
    session.items.push({
      itemType: input.detectedType,
      quantity: 1,
      pointsPerItem: POINTS_PER_ITEM[input.detectedType],
      avgConfidence: Number(input.confidence.toFixed(4)),
    });
  }
  session.totalItems += 1;
  session.totalPoints += POINTS_PER_ITEM[input.detectedType];
  session.lastDetectionAt = now;
  await session.save();

  if (requestedMode === 'inactivity' && sessionModeOf(session) !== 'manual') {
    scheduleFinalization(machine.machineCode, String(session._id), SESSION_TIMEOUT_MS);
  }
  return { event, session, duplicate: false };
}

export async function finalizeMachineSession(machineCode: string, now = new Date()): Promise<any | null> {
  const existingLock = finalizationLocks.get(machineCode);
  if (existingLock) return existingLock;
  const operation = finalizeMachineSessionOnce(machineCode, now);
  finalizationLocks.set(machineCode, operation);
  try {
    return await operation;
  } finally {
    if (finalizationLocks.get(machineCode) === operation) finalizationLocks.delete(machineCode);
  }
}

async function finalizeMachineSessionOnce(machineCode: string, now: Date): Promise<any | null> {
  const machine: any = await MachineModel.findOne({ machineCode });
  if (!machine) return null;
  const session: any = await ContributionSessionModel.findOne({ machineId: machine._id, status: 'collecting' });
  if (!session || !hasItems(session)) return null;
  return finalizeSession(String(session._id), now, true);
}

export async function resumeCollectingSessions(now = new Date()): Promise<void> {
  const sessions: any[] = await ContributionSessionModel.find({ status: 'collecting' });
  for (const session of sessions) {
    if (sessionModeOf(session) === 'manual') continue;
    const lastDetectionAt = new Date(session.lastDetectionAt ?? session.createdAt);
    const remaining = lastDetectionAt.getTime() + SESSION_TIMEOUT_MS - now.getTime();
    scheduleFinalization(String(session.machineCode), String(session._id), remaining);
  }
}
