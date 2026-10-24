const { test } = require('node:test');
const assert = require('node:assert/strict');

const { DEMO_LIVE_FEED, DEMO_OVERVIEW } = require('../src/services/demoData.ts');
const { buildDashboardReport } = require('../src/services/reportExport.ts');

test('dashboard export builds a formatted PDF from the selected snapshot', () => {
  const report = buildDashboardReport({
    overview: DEMO_OVERVIEW,
    liveFeed: DEMO_LIVE_FEED,
    range: 'week',
    generatedAt: new Date('2026-09-11T08:00:00Z'),
  });

  const bytes = report.output('arraybuffer').byteLength;
  assert.ok(bytes > 8_000, `expected a substantive PDF, received ${bytes} bytes`);
  assert.ok(report.getNumberOfPages() >= 1);
});
