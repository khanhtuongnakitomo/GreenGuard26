const { test } = require('node:test');
const assert = require('node:assert/strict');
delete process.env.EXPO_PUBLIC_DEMO_MODE;
const { dashboardQuery } = require('../src/services/dashboardQueries.ts');
test('default presentation mode stays populated and does not poll', async () => {
  const options=dashboardQuery();
  assert.equal(options.initialData.overview.todayDetections,128);
  assert.equal(options.refetchInterval,false);
  const previous=global.fetch;
  global.fetch=()=>{throw new Error('demo must not contact the server');};
  try { assert.equal((await options.queryFn({signal:new AbortController().signal})).overview.todayDetections,128); }
  finally {global.fetch=previous;}
});
