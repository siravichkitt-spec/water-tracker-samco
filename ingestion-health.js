'use strict';
// Poll health is separate from station measurement freshness.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SamcoIngestionHealth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function count(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  }
  function summarize(run, sites = []) {
    if (!run || run.run_type !== 'poll') {
      return { status: 'unknown', text: 'ingestion health unavailable', issues: [] };
    }
    const active = count(run.active_sites);
    const processed = count(run.processed_readings);
    const skipped = Array.isArray(run.skipped) ? run.skipped : [];
    const bySite = new Map();
    for (const entry of skipped) {
      if (!entry || typeof entry !== 'object') continue;
      const id = typeof entry.site_id === 'string' ? entry.site_id : null;
      const key = id || '__source__';
      if (!bySite.has(key)) bySite.set(key, { siteId: id, reasons: new Set() });
      bySite.get(key).reasons.add(entry.reason);
    }
    const issues = [...bySite.values()].map(issue => {
      const name = sites.find(site => site.id === issue.siteId)?.name || issue.siteId || 'แหล่งข้อมูล';
      const reasons = issue.reasons;
      let message;
      if (reasons.has('no_station')) message = 'ยังไม่ได้กำหนดสถานี';
      else if (reasons.has('no_data')) message = 'ไม่มีข้อมูล';
      else if (reasons.has('rid_history_error')) message = 'แหล่ง RID ขัดข้อง';
      else if (reasons.has('rid_history_no_valid_data')) message = 'RID ไม่มีข้อมูลที่ใช้ได้';
      else if (reasons.has('thaiwater_error')) message = 'ThaiWater ขัดข้อง';
      else message = 'มีคำเตือนแหล่งข้อมูล';
      return { siteId: issue.siteId, message: name + ' ' + message, reasons: [...reasons] };
    });
    let status = ['running', 'success', 'partial', 'failed'].includes(run.status) ? run.status : 'unknown';
    // Older poll versions stored SUCCESS even when a site/feed was skipped.
    if (status === 'success' && (issues.length || (active !== null && processed !== null && processed < active))) {
      status = 'partial';
    }
    const coverage = active !== null && active > 0 && processed !== null
      ? processed + '/' + active + ' ไซต์' : null;
    let text;
    if (status === 'running') text = 'ingestion RUNNING · กำลังดึงข้อมูล';
    else if (status === 'failed') text = 'ingestion FAILED' + (coverage ? ' · บันทึก ' + coverage : '');
    else if (status === 'unknown') text = 'ingestion UNKNOWN';
    else text = 'ingestion ' + status.toUpperCase() + (coverage ? ' · สำเร็จ ' + coverage : ' · ไม่ทราบจำนวนไซต์');
    if (status !== 'running' && issues.length) text += ' · ' + issues.map(issue => issue.message).join(' · ');
    return { status, text, issues, activeSites: active, processedReadings: processed };
  }
  return { summarize };
});
