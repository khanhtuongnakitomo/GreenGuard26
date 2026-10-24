const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const sessions = require('../src/models/ContributionSession.ts').default;
const detections = require('../src/models/DetectionEvent.ts').default;
const machines = require('../src/models/Machine.ts').default;
const service = require('../src/services/demoSession.ts');

test('demo session summaries retain countdown and active QR without exposing stored credentials', () => {
  const now = new Date('2026-10-24T00:00:00Z');
  const row = {
    _id: 'session-1', status: 'collecting', machineCode: '0001', finalizationMode: 'inactivity',
    lastDetectionAt: now, expiresAt: new Date(now.getTime() + 60_000),
    claimTokenHash: 'private-hash', passwordHash: 'private-password', qrPayload: 'claim-qr',
    machineId: { machineCode: '0001', apiKey: 'private-key' },
  };
  const collecting = service.sessionSummary(row, now);
  assert.equal(collecting.timeoutAt, '2026-10-24T00:00:10.000Z');
  assert.equal(collecting.finalizationMode, 'inactivity');
  assert.equal(collecting.machineCode, '0001');
  assert.equal(collecting.claimTokenHash, undefined);
  assert.equal(collecting.passwordHash, undefined);
  assert.equal(collecting.machineId.apiKey, undefined);
  assert.equal(collecting.qrPayload, undefined);
  assert.equal(service.sessionSummary({ ...row, finalizationMode: 'manual' }, now).timeoutAt, null);
  assert.equal(service.sessionSummary({ ...row, status: 'unclaimed' }, now).qrPayload, 'claim-qr');
  assert.equal(service.sessionSummary({ ...row, status: 'claimed' }, now).qrPayload, undefined);
  assert.equal(service.sessionSummary({ ...row, status: 'unclaimed', expiresAt: now }, now).qrPayload, undefined);
  assert.equal(service.sessionSummary(null, now), null);
});

const originals = {
  sessionFindOne: sessions.findOne,
  sessionCreate: sessions.create,
  detectionFindOne: detections.findOne,
  detectionCreate: detections.create,
  machineFindOneAndUpdate: machines.findOneAndUpdate,
  machineFindByIdAndUpdate: machines.findByIdAndUpdate,
};

afterEach(() => {
  sessions.findOne = originals.sessionFindOne;
  sessions.create = originals.sessionCreate;
  detections.findOne = originals.detectionFindOne;
  detections.create = originals.detectionCreate;
  machines.findOneAndUpdate = originals.machineFindOneAndUpdate;
  machines.findByIdAndUpdate = originals.machineFindByIdAndUpdate;
});

test('local detections aggregate every item and points in one collecting session', async () => {
  const machine = { _id: 'machine-1', machineCode: '0001', name: 'Demo machine' };
  const session = {
    _id: 'session-1',
    sessionCode: 'DEMO-ONE',
    machineId: machine._id,
    machineCode: machine.machineCode,
    items: [],
    totalItems: 0,
    totalPoints: 0,
    async save() {},
  };
  const events = [];
  detections.findOne = async ({ eventId }) => events.find((item) => item.eventId === eventId) ?? null;
  detections.create = async (payload) => { events.push(payload); return payload; };
  machines.findOneAndUpdate = async () => machine;
  sessions.findOne = async () => session.totalItems ? session : null;
  sessions.create = async () => session;

  await service.recordDemoDetection({eventId:'one',machineCode:'0001',detectedType:'pet_clean',confidence:0.82});
  await service.recordDemoDetection({eventId:'two',machineCode:'0001',detectedType:'pet_clean',confidence:0.88});
  await service.recordDemoDetection({eventId:'three',machineCode:'0001',detectedType:'pet_bad',confidence:0.91});

  assert.equal(session.totalItems, 3);
  assert.equal(session.totalPoints, 25);
  assert.deepEqual(session.items.map(item => [item.itemType,item.quantity,item.pointsPerItem]), [
    ['pet_clean', 2, 10],
    ['pet_bad', 1, 5],
  ]);
  assert.equal(session.items[0].avgConfidence, 0.85);
  assert.ok(events.every(event => event.sessionCode === 'DEMO-ONE'));
});

test('duplicate event IDs do not add the same object twice', async () => {
  const existing = { eventId: 'same', sessionCode: 'DEMO-ONE' };
  detections.findOne = async () => existing;
  sessions.findOne = async () => ({ sessionCode: 'DEMO-ONE', totalItems: 1 });
  detections.create = async () => { throw new Error('must not create duplicate'); };

  const result = await service.recordDemoDetection({eventId:'same',machineCode:'0001',detectedType:'aluminum',confidence:0.9});
  assert.equal(result.duplicate, true);
  assert.equal(result.session.totalItems, 1);
});

test('finalization closes the session and creates QR data after ten seconds', async () => {
  const lastDetectionAt = new Date('2026-09-09T00:00:00.000Z');
  const session = {
    _id: 'session-1',
    sessionCode: 'DEMO-ONE',
    machineId: 'machine-1',
    machineCode: '0001',
    status: 'collecting',
    items: [{itemType:'aluminum',quantity:2,pointsPerItem:8,avgConfidence:0.9}],
    totalItems: 2,
    totalPoints: 16,
    lastDetectionAt,
    async save() {},
  };
  sessions.findOne = async () => session;
  machines.findByIdAndUpdate = async () => ({});

  await service.finalizeSession('session-1', new Date(lastDetectionAt.getTime() + 10_000));
  assert.equal(session.status, 'unclaimed');
  assert.equal(JSON.parse(session.qrPayload).totalItems, 2);
  assert.equal(JSON.parse(session.qrPayload).totalPoints, 16);
  assert.equal(JSON.parse(session.qrPayload).machineCode, '0001');
});
