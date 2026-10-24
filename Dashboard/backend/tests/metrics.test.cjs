const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateImpact } = require('../src/services/impact.ts');
const sessions = require('../src/models/ContributionSession.ts').default;
const detections = require('../src/models/DetectionEvent.ts').default;
const machines = require('../src/models/Machine.ts').default;
const controller = require('../src/controllers/dashboard.controller.ts');
const contribution = (createdAt, itemType, quantity) => ({createdAt, items:[{itemType,quantity}]});
const query = data => ({sort(){return this;},limit(){return this;},select(){return this;},populate(){return this;},lean:async()=>data,then:resolve=>Promise.resolve(data).then(resolve)});
const capture = async fn => { let body; await fn({query:{}}, {json:value=>{body=value;}}); return body; };
const captureWithQuery = async (fn, requestQuery) => { let body; await fn({query:requestQuery}, {json:value=>{body=value;}}); return body; };

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

test('bad PET is counted as a rejected detection while remaining in the waste breakdown', async () => {
  detections.find=()=>query([
    {capturedAt:new Date(),detectedType:'pet_clean',confidence:0.9},
    {capturedAt:new Date(),detectedType:'pet_bad',confidence:0.8},
    {capturedAt:new Date(),detectedType:'aluminum',confidence:0.95},
  ]);
  machines.find=()=>Promise.resolve([]);
  sessions.countDocuments=async()=>0;
  const overview=await capture(controller.getOverview);
  assert.equal(overview.acceptRate,66.7);
  assert.deepEqual(overview.wasteBreakdown,{pet_clean:1,pet_bad:1,aluminum:1});
  assert.equal(overview.classificationTrend[0].pet_clean,1);
  assert.equal(overview.classificationTrend[0].pet_bad,1);
  assert.equal(overview.classificationTrend[0].aluminum,1);
});

test('overview supports 7-day, 30-day, and all-time measurements', async () => {
  let filter;
  detections.find = value => { filter=value; return query([]); };
  machines.find=()=>Promise.resolve([]);
  sessions.countDocuments=async()=>0;

  const week = await captureWithQuery(controller.getOverview, {range:'week'});
  assert.equal(week.range, 'week');
  assert.equal(week.totalDetections, 0);
  assert.ok(filter.capturedAt.$gte instanceof Date);

  const month = await captureWithQuery(controller.getOverview, {range:'month'});
  assert.equal(month.range, 'month');
  assert.ok(filter.capturedAt.$gte instanceof Date);

  const all = await captureWithQuery(controller.getOverview, {range:'all'});
  assert.equal(all.range, 'all');
  assert.deepEqual(filter, {});
});

test('live feed marks pet_bad as reject for the dashboard', async () => {
  detections.find=()=>query([{capturedAt:new Date(),machineCode:'0001',detectedType:'pet_bad',confidence:0.8}]);
  sessions.find=()=>query([]);
  const feed=await capture(controller.getLiveFeed);
  assert.equal(feed[0].detectedType,'pet_bad');
  assert.equal(feed[0].decision,'reject');
});
