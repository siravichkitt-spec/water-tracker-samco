'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { summarize } = require('./ingestion-health.js');
const sites = [{ id: 'buengkan-nam-hi', name: 'บึงกาฬ' }];
const base = { run_type: 'poll', status: 'success', active_sites: 5, processed_readings: 4, skipped: [
  { site_id: 'buengkan-nam-hi', reason: 'no_data' },
  { site_id: 'buengkan-nam-hi', reason: 'rid_history_error', error: 'RID Big Data HTTP 404' },
] };
test('Legacy SUCCESS 4/5 becomes PARTIAL with one named missing-site message', () => {
  const result = summarize(base, sites);
  assert.equal(result.status, 'partial');
  assert.match(result.text, /สำเร็จ 4\/5 ไซต์/);
  assert.match(result.text, /บึงกาฬ ไม่มีข้อมูล/);
  assert.equal(result.issues.length, 1);
  assert.equal((result.text.match(/บึงกาฬ/g) || []).length, 1);
});
test('Counts detect incomplete old runs even if skipped is unavailable', () => {
  assert.equal(summarize({ ...base, skipped: null }).status, 'partial');
});
test('Complete poll stays SUCCESS and source warning remains PARTIAL at 5/5', () => {
  assert.equal(summarize({ ...base, processed_readings: 5, skipped: [] }).status, 'success');
  assert.equal(summarize({ ...base, processed_readings: 5, skipped: [base.skipped[1]] }).status, 'partial');
});
test('FAILED, RUNNING and unknown counts never claim full success', () => {
  assert.match(summarize({ ...base, status: 'failed' }).text, /FAILED/);
  assert.doesNotMatch(summarize({ ...base, status: 'failed' }).text, /สำเร็จ/);
  assert.doesNotMatch(summarize({ ...base, status: 'running', processed_readings: 0 }).text, /0\/5/);
  assert.doesNotMatch(summarize({ ...base, active_sites: null, processed_readings: null, skipped: [] }).text, /0\/0/);
  assert.equal(summarize({ ...base, status: 'other' }).status, 'unknown');
});
test('Backfills and absent health never masquerade as poll success', () => {
  assert.equal(summarize(null).status, 'unknown');
  assert.equal(summarize({ ...base, run_type: 'backfill', processed_readings: 1000 }).status, 'unknown');
});
test('Unknown/new sites and source-only failures have honest fallback labels', () => {
  assert.match(summarize({ ...base, skipped: [{ site_id: 'new', reason: 'no_station' }] }).text, /new ยังไม่ได้กำหนดสถานี/);
  assert.match(summarize({ ...base, skipped: [{ reason: 'thaiwater_error' }] }).text, /ThaiWater ขัดข้อง/);
  assert.doesNotThrow(() => summarize({ ...base, skipped: [null, 'bad', {}] }));
});
test('Browser export and text-only renderer use poll filter and skipped diagnostics', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync('ingestion-health.js','utf8'), sandbox);
  assert.equal(sandbox.SamcoIngestionHealth.summarize(base, sites).status, 'partial');
  const html = fs.readFileSync('index.html','utf8');
  const fetchCode = html.match(/async function fetchLatestIngestion\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(fetchCode, /error_message, skipped/);
  assert.match(fetchCode, /\.eq\('run_type', 'poll'\)/);
  const renderCode = html.match(/function renderConnectionStatus\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(renderCode, /SamcoIngestionHealth\.summarize/);
  assert.match(renderCode, /el\.textContent/);
  assert.doesNotMatch(renderCode, /innerHTML/);
});
test('Rendering health updates does not carry stale status after reconnect or site switch', () => {
  const html = fs.readFileSync('index.html','utf8');
  const renderCode = html.match(/function renderConnectionStatus\(\) \{[\s\S]*?\n\}/)[0];
  const element = { dataset: {}, textContent: '' };
  const sandbox = { document: { getElementById: () => element }, realtimeState: 'SUBSCRIBED',
    latestIngestion: base, SITES: sites, SamcoIngestionHealth: { summarize }, formatAge: () => '1 min' };
  vm.runInNewContext(renderCode, sandbox);
  sandbox.renderConnectionStatus();
  assert.equal(element.dataset.ingestionStatus, 'partial');
  sandbox.latestIngestion = null;
  sandbox.renderConnectionStatus();
  assert.equal(element.dataset.ingestionStatus, 'unknown');
  assert.match(element.textContent, /health unavailable/);
  sandbox.latestIngestion = { ...base, processed_readings: 5, skipped: [] };
  sandbox.renderConnectionStatus();
  assert.equal(element.dataset.ingestionStatus, 'success');
  assert.doesNotMatch(element.textContent, /ไม่มีข้อมูล/);
});
