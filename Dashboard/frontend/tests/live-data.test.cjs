const { test, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
const { QueryClient } = require('@tanstack/react-query');
const { dashboardQuery, analyticsQuery } = require('../src/services/dashboardQueries.ts');
const { fetchJson } = require('../src/services/api.ts');
const originalFetch = global.fetch;
after(()=>{global.fetch=originalFetch;});
const success = async()=>({ok:true,json:async()=>({marker:'live'})});

test('live mode starts without demonstration data', () => {
  assert.equal(dashboardQuery().initialData, undefined);
  assert.equal(analyticsQuery().initialData, undefined);
});

test('initial outage stays unavailable; recovery returns actual data', async () => {
  const qc = new QueryClient();
  global.fetch = async()=>{throw new Error('offline');};
  await assert.rejects(qc.fetchQuery(dashboardQuery()));
  assert.equal(qc.getQueryData(dashboardQuery().queryKey), undefined);
  global.fetch = success;
  assert.equal((await qc.fetchQuery(dashboardQuery())).overview.marker, 'live');
  qc.clear();
});

test('partial outage retains the last complete snapshot and records error', async () => {
  const qc = new QueryClient();
  global.fetch = success;
  const previous = await qc.fetchQuery(dashboardQuery());
  global.fetch = async url=> {
    if (url.includes('/live')) throw new Error('feed offline');
    return {ok:true,json:async()=>({marker:'new'})};
  };
  await assert.rejects(qc.fetchQuery(dashboardQuery()));
  assert.deepEqual(qc.getQueryData(dashboardQuery().queryKey), previous);
  assert.equal(qc.getQueryState(dashboardQuery().queryKey).status, 'error');
  global.fetch = success;
  await qc.fetchQuery(dashboardQuery());
  assert.equal(qc.getQueryState(dashboardQuery().queryKey).status, 'success');
  qc.clear();
});

test('cancellation aborts the active request', async () => {
  let started;
  const ready = new Promise(resolve=>{started=resolve;});
  global.fetch = async (_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
    started();
  });
  const controller = new AbortController();
  const pending = fetchJson('/api/dashboard/overview',controller.signal);
  const rejected = assert.rejects(pending,/aborted/);
  await ready; controller.abort(); await rejected;
});
