const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateImpact } = require('../src/services/impact.ts');
const sessions = require('../src/models/ContributionSession.ts').default;
const detections = require('../src/models/DetectionEvent.ts').default;
const machines = require('../src/models/Machine.ts').default;
const controller = require('../src/controllers/dashboard.controller.ts');
const contribution = (createdAt, itemType, quantity) => ({createdAt, items:[{itemType,quantity}]});
const query = data => ({sort(){return this;},limit(){return this;},select(){return this;},lean:async()=>data,then:resolve=>Promise.resolve(data).then(resolve)});
const capture = async fn => { let body; await fn({query:{}}, {json:value=>{body=value;}}); return body; };

test('impact separates months and uses recycling time in UTC at boundaries', () => {
  const result = calculateImpact([
    contribution('2026-09-05T00:00:00Z','pet_clean',2),
    contribution('2026-09-01T00:30:00+07:00','can',3),
    contribution('2026-08-15T00:00:00Z','aluminum',4),
  ]);
  assert.deepEqual(result.byMonth.map(m=>[m.month,m.items]), [['2026-08',7],['2026-09',2]]);
  assert.equal(result.byMonth[0].kgPerType.aluminum, 0.105.toFixed(2) * 1);
  assert.equal(result.timeZone, 'UTC');
});

test('empty impact has no invented month; undated records stay explicit', () => {
  assert.deepEqual(calculateImpact([]).byMonth, []);
  const result = calculateImpact([contribution('invalid','pet_clean',2)]);
  assert.equal(result.undatedItems, 2);
  assert.deepEqual(result.byMonth, []);
  assert.ok(result.co2SavedKg > 0);
});

test('legacy aliases contribute independently of order', () => {
  const rows = [contribution('2026-09-01','plastic_bottle',2),contribution('2026-09-01','pet_clean',3)];
  assert.deepEqual(calculateImpact(rows), calculateImpact([...rows].reverse()));
  assert.equal(calculateImpact(rows).byMonth[0].items,5);
});

test('impact endpoint selects claimed sessions and reports September correctly', async () => {
  sessions.find = filter => { assert.deepEqual(filter,{status:'claimed'}); return query([contribution('2026-09-05','pet_clean',2)]); };
  assert.equal((await capture(controller.getImpactMetrics)).byMonth[0].month, '2026-09');
});

test('empty live telemetry returns unavailable measurements, not demonstration numbers', async () => {
  detections.find = () => query([]);
  machines.find = () => Promise.resolve([]);
  sessions.countDocuments = async () => 7;
  const overview = await capture(controller.getOverview);
  assert.equal(overview.avgConfidence, null);
  assert.equal(overview.avgFps, null);
  assert.equal(overview.acceptRate, null);
  assert.equal(overview.purityRate, null);
  assert.equal(overview.pendingSync, null);
  assert.equal(overview.unclaimedSessions, 7);
  assert.equal(overview.binsOnline, '0/0');
  const quality = await capture(controller.getQualityMetrics);
  assert.equal(quality.latencyP50, null);
  assert.equal(quality.latencyP95, null);
});

test('measured zero FPS and confidence are distinct from missing measurements', async () => {
  detections.find=()=>query([{capturedAt:new Date(),detectedType:'reject',confidence:0,fps:0}]);
  machines.find=()=>Promise.resolve([]);
  sessions.countDocuments=async()=>0;
  const overview=await capture(controller.getOverview);
  assert.equal(overview.avgFps,0);
  assert.equal(overview.avgConfidence,0);
  assert.equal(overview.acceptRate,0);
});
