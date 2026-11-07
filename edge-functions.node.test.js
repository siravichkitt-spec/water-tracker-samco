'use strict';
// Dependency-free Node 24 regression harness. Production network/client imports
// are replaced only in this isolated VM. No Deno deployment/type-check is implied.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function source(file) {
  return stripTypeScriptTypes(fs.readFileSync(file, 'utf8')
    .replace(/^import "[^"]+";\r?\n/gm, '')
    .replace(/^import \{ createClient \} from "[^"]+";\r?\n/gm, '')
    .replace(/^export /gm, '')
    .replace(/if \(import\.meta\.main\) \{[\s\S]*?\n\}/g, ''));
}
function load(file, overrides = {}) {
  const context = {
    URL, Request, Response, AbortSignal, console: { error() {} },
    Deno: { env: { get: () => 'isolated-test-only' }, test },
    createClient: () => { throw Error('Unexpected database access in pure test'); },
    fetch: () => { throw Error('Unexpected network access'); },
    ...overrides,
  };
  vm.createContext(context);
  vm.runInContext(source(file), context, { filename: file });
  return context;
}
// Run the original six Deno-style pure tests through the Node test runner too.
for (const file of ['edge-function-poll', 'edge-function-backfill']) {
  const context = load(file + '.ts');
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync(file + '.test.ts','utf8')
    .replace(/^import \{[\s\S]*?\} from "[^"]+";\r?\n/, '')), context);
}
const sites = Array.from({ length: 5 }, (_, n) => ({
  id: n === 4 ? 'buengkan-nam-hi' : 'site-' + n,
  station_id: n === 4 ? 11688687 : n + 1,
  station_code: n === 4 ? 'TKS.121' : 'TW' + n,
  datum_offset: 10, datum_offset_local: n === 4,
  alert_warn_design_level: null, alert_crit_design_level: null,
}));
function harness(options = {}) {
  const state = { runs: [], writes: [], fetches: [], inserts: 0 };
  const selected = options.sites || sites;
  const client = {
    rpc: async () => ({ data: options.authorized !== false, error: null }),
    from(table) {
      if (table === 'water_tracker_sites') return { select: () => ({ eq: () => ({
        order: async () => ({ data: selected, error: null }),
      }) }) };
      if (table === 'water_tracker_ingestion_runs') return {
        insert: () => { state.inserts++; return { select: () => ({ single: async () => ({ data: { id: 1 }, error: null }) }) }; },
        update: values => ({ eq: async () => { state.runs.push(values); return { error: null }; } }),
      };
      if (table === 'water_tracker_readings') return {
        select: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({
          data: options.cooldown ? { fetched_at: new Date().toISOString() } : null, error: null,
        }) }) }) }),
        upsert: rows => { state.writes.push(rows); return { select: async () => ({
          data: options.writeError ? null : rows.map((row, n) => ({ ...row, id: n + 1 })),
          error: options.writeError ? new Error('mock_write_failure') : null,
        }) }; },
      };
      if (table === 'water_tracker_alerts') return { upsert: async () => ({ error: null }) };
      throw new Error('Unexpected table ' + table);
    },
  };
  const context = load('edge-function-poll.ts', {
    createClient: () => client,
    fetch: async url => {
      state.fetches.push(String(url));
      if (String(url).includes('rid.go.th')) assert.equal(new URL(url).origin + new URL(url).pathname, 'https://bigdata.rid.go.th/api/ma/pier/rid/get_pier_by_station');
      if (String(url).includes('thaiwater')) {
        if (options.thaiError) return new Response('', { status: 503 });
        const included = options.includeBuengkan ? sites : sites.slice(0,4);
        return Response.json({ waterlevel_data: { data: included.map((site, n) => ({
          station: { id: site.station_id }, waterlevel_msl: 2 + n,
          waterlevel_datetime: '2026-11-07 10:00:00',
        })) } });
      }
      if (String(url).includes('rid.go.th')) {
        if (!options.ridSuccess) return new Response('', { status: 404 });
        return Response.json({ success: true, data: [{
          station_code: 'TKS.121', hourly_time_utc: '2026-11-07T04:00:00Z', wl_values_msl: 182.5, wl_values: 4.5,
        }] });
      }
      throw new Error('Unexpected source ' + url);
    },
  });
  return { state, run: async (method = 'GET') => {
    const response = await context.handlePoll(new Request('https://local.test/poll', {
      method, headers: { 'x-samco-cron-secret': 'isolated-test-only' },
    }));
    return { status: response.status, body: await response.json() };
  } };
}
test('Poll persists 4/5 as PARTIAL and includes missing-site plus RID error', async () => {
  const { state, run } = harness();
  const result = await run();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.status, 'partial');
  assert.equal(state.runs.at(-1).status, 'partial');
  assert.equal(state.runs.at(-1).active_sites, 5);
  assert.equal(state.runs.at(-1).processed_readings, 4);
  assert.equal(result.body.skipped.filter(x => x.site_id === 'buengkan-nam-hi').length, 2);
  assert.equal(state.writes[0].length, 4);
});
test('Poll complete 5/5 succeeds and local-datum reading stays unconverted', async () => {
  const { state, run } = harness({ ridSuccess: true });
  const result = await run();
  assert.equal(result.body.status, 'success');
  assert.equal(result.body.processed_readings, 5);
  assert.equal(state.writes[0].find(row => row.site_id === 'buengkan-nam-hi').wl_design, null);
});
test('Poll 5/5 with fallback source error remains PARTIAL', async () => {
  const { run } = harness({ includeBuengkan: true });
  const result = await run();
  assert.equal(result.body.status, 'partial');
  assert.equal(result.body.processed_readings, 5);
  assert.equal(result.body.skipped[0].reason, 'rid_history_error');
});
test('ThaiWater failure does not suppress independently working RID feed', async () => {
  const { state, run } = harness({ thaiError: true, ridSuccess: true });
  const result = await run();
  assert.equal(result.body.status, 'partial');
  assert.equal(result.body.processed_readings, 1);
  assert.equal(state.writes[0][0].site_id, 'buengkan-nam-hi');
});
test('All-source outage fails without readings and preserves site diagnostics', async () => {
  const { state, run } = harness({ thaiError: true });
  const result = await run();
  assert.equal(result.status, 500);
  assert.equal(state.writes.length, 0);
  assert.equal(state.runs.at(-1).status, 'failed');
  assert.equal(state.runs.at(-1).active_sites, 5);
  assert.equal(state.runs.at(-1).processed_readings, 0);
  assert.equal(state.runs.at(-1).skipped.filter(x => x.reason === 'no_data').length, 5);
});
test('Missing station is named in partial diagnostics, never invented', async () => {
  const { run } = harness({ sites: [...sites, { id: 'no-station', station_id: null }] });
  const result = await run();
  assert.equal(result.body.active_sites, 6);
  assert.ok(result.body.skipped.some(x => x.site_id === 'no-station' && x.reason === 'no_station'));
});
test('Database failure cannot be reported as partial success', async () => {
  const { state, run } = harness({ writeError: true });
  const result = await run();
  assert.equal(result.status, 500);
  assert.equal(result.body.ok, false);
  assert.equal(state.runs.at(-1).status, 'failed');
  assert.equal(state.runs.at(-1).processed_readings, 0);
});
test('Method, authorization and cooldown guards cause no fetch or writes', async () => {
  for (const [options, method, status] of [[{}, 'POST', 405], [{ authorized: false }, 'GET', 401], [{ cooldown: true }, 'GET', 200]]) {
    const { state, run } = harness(options);
    assert.equal((await run(method)).status, status);
    assert.equal(state.fetches.length, 0);
    assert.equal(state.writes.length, 0);
    assert.equal(state.inserts, 0);
  }
});

test('RID latest uses explicit MSL and preserves timezone-qualified timestamp', async () => {
  const context = load('edge-function-poll.ts', { fetch: async url => {
    assert.equal(new URL(url).origin, 'https://bigdata.rid.go.th');
    assert.equal(new URL(url).searchParams.get('station_code'), 'TKS.121');
    return Response.json({ success: true, data: [
      { station_code: 'TKS.121', hourly_time_utc: '2026-11-07T14:30:00.000Z', wl_values_msl: 181.28, wl_values: 3.28 },
    ] });
  } });
  const reading = await context.fetchRidLatest('TKS.121');
  assert.equal(reading.wl_msl, 181.28);
  assert.equal(reading.measured_at, '2026-11-07T14:30:00.000Z');
});
test('RID never falls back to relative values or accepts wrong station/time', async () => {
  for (const row of [
    { station_code: 'TKS.121', hourly_time_utc: '2026-11-07T14:30:00Z', wl_values: 3.28 },
    { station_code: 'TKS.121', hourly_time_utc: '2026-11-07T14:30:00Z', wl_values_msl: null, wl_values: 3.28 },
    { station_code: 'TKS.121', hourly_time_utc: '2026-11-07T14:30:00Z', wl_values_msl: false },
    { station_code: 'OTHER', hourly_time_utc: '2026-11-07T14:30:00Z', wl_values_msl: 181.28 },
    { station_code: 'TKS.121', hourly_time_utc: '2026-11-07 14:30:00', wl_values_msl: 181.28 },
  ]) {
    const context = load('edge-function-poll.ts', { fetch: async () => Response.json({ success: true, data: [row] }) });
    assert.equal(await context.fetchRidLatest('TKS.121'), null);
  }
});
const BACKFILL_TEST_TIME = '2026-11-07T18:00:00.000Z'; // Nov 8 in Bangkok.
class BackfillClock extends Date {
  constructor(...args) { super(...(args.length ? args : [BACKFILL_TEST_TIME])); }
  static now() { return Date.parse(BACKFILL_TEST_TIME); }
}
async function backfillDryRun(points) {
  const site = sites[4];
  const query = data => {
    const result = { select() { return this; }, eq() { return this; }, gte() { return this; },
      lte() { return this; }, order() { return this; }, range() { return this; },
      then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); } };
    return result;
  };
  const client = { rpc: async () => ({ data: true, error: null }), from(table) {
    if (table === 'water_tracker_sites') return query([site]);
    if (table === 'water_tracker_readings') return query([]);
    throw new Error('Dry run attempted a write/run record: ' + table);
  } };
  const context = load('edge-function-backfill.ts', { Date: BackfillClock, createClient: () => client, fetch: async url => {
    assert.equal(new URL(url).origin + new URL(url).pathname, 'https://bigdata.rid.go.th/api/ma/pier/rid/get_pier_by_station');
    assert.equal(new URL(url).searchParams.get('from_date'), '2026-11-06');
    assert.equal(new URL(url).searchParams.get('to_date'), '2026-11-08');
    return Response.json({ success: true, data: points });
  } });
  const response = await context.handleBackfill(new Request('https://local.test/backfill?days=2&site=buengkan-nam-hi', {
    method: 'POST', headers: { 'x-samco-cron-secret': 'isolated-test-only' },
  }));
  return { status: response.status, body: await response.json() };
}
test('Backfill dry run uses explicit MSL with no write calls', async () => {
  const result = await backfillDryRun([{ station_code: 'TKS.121', hourly_time_utc: BACKFILL_TEST_TIME,
    wl_values_msl: 181.28, wl_values: 3.28 }]);
  assert.equal(result.status, 200);
  assert.equal(result.body.safe_to_write, true);
  assert.equal(result.body.summary[0].minimum_wl_msl, 181.28);
});
test('Backfill relative-only and invalid MSL values fail safely', async () => {
  for (const invalid of [undefined, null, '', false, [], {}]) {
    const result = await backfillDryRun([{ station_code: 'TKS.121', hourly_time_utc: BACKFILL_TEST_TIME,
      wl_values_msl: invalid, wl_values: 3.28 }]);
    assert.equal(result.status, 422);
    assert.equal(result.body.safe_to_write, false);
    assert.equal(result.body.candidate_readings, 0);
    assert.equal(result.body.summary[0].error, 'source_has_no_valid_water_level_values');
    assert.equal(result.body.summary[0].out_of_range_points, 0);
  }
});
test('Backfill wrong station and conflicting timestamps remain blocked', async () => {
  const time = BACKFILL_TEST_TIME;
  for (const points of [
    [{ station_code: 'OTHER', hourly_time_utc: time, wl_values_msl: 181.28 }],
    [{ station_code: 'TKS.121', hourly_time_utc: time, wl_values_msl: 181.28 },
     { station_code: 'TKS.121', hourly_time_utc: time, wl_values_msl: 181.29 }],
  ]) {
    const result = await backfillDryRun(points);
    assert.equal(result.status, 422);
    assert.equal(result.body.safe_to_write, false);
    assert.match(result.body.summary[0].error, /source_station_identity_mismatch|conflicting_duplicate_timestamp/);
  }
});
