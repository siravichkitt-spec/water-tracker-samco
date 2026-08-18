# Water Tracker Production Audit

**Bottom line:** ระบบ Water Tracker ของ **SAMCO LOGISTICS** ผ่าน production gate สำหรับ public read-only และใช้งานที่ https://samco-water-tracker.vercel.app ได้แล้ว ณ 2026-08-18. Backend อยู่ใน Supabase project samco-logistics ไม่ได้ปะปนกับ project samakee.

- Entity / owner: **SAMCO LOGISTICS**
- Authority: **(ก) แพนสั่งได้เอง**
- Application release commit: ef8b77a
- Release marker: water-tracker-v3-20260818
- Audit date: 2026-08-18

## 1. Project identity and separation

| Check | Result | Evidence date |
|---|---|---|
| SAMCO LOGISTICS Supabase project | samco-logistics / yiyoagypmcnatdauuadf | 2026-08-18 |
| สามัคคี Supabase project | samakee / cytubwddgjaxdnamfpxp | 2026-08-18 |
| Water Tracker tables located in | samco-logistics | 2026-08-18 |
| Cross-company data mixing found | No | 2026-08-18 |

## 2. Production architecture

1. ThaiWater publishes station telemetry.
2. Supabase cron invokes water-tracker-poll every 15 minutes using a secret stored in Supabase Vault.
3. Edge Function validates the secret, fetches ThaiWater once, validates values/timestamps, upserts readings and writes an ingestion audit run.
4. Browser uses a publishable key and has SELECT-only access under RLS.
5. Supabase Realtime pushes reading/ingestion changes to the browser; a five-minute fallback refresh covers disconnected Realtime sessions.
6. Vercel serves the static dashboard from GitHub master.

## 3. Data audit

Observed from Supabase production at 2026-08-18 14:30:53 ICT.

| Metric | Observed | Verification |
|---|---:|---|
| Active sites | 5 | direct SQL count |
| Reading rows | 121,799 | direct SQL count |
| Alert rows | 91 | direct SQL count |
| Ingestion audit runs | 2 | direct SQL count |
| Duplicate reading keys | 0 | grouped duplicate check on site/station/timestamp |
| Duplicate alert keys | 0 | grouped duplicate check on reading/level |
| Latest successful ingestion | 2026-08-18 14:30:03 ICT | ingestion run id 2 |
| Sites processed in run id 2 | 5 | ingestion audit |
| Sites skipped in run id 2 | 0 | ingestion audit |
| Errors in run id 2 | 0 | error_message is null |

Direct ThaiWater comparison at 2026-08-18 14:21:27 ICT found four exact timestamp/value matches. โคกสลุด had a ThaiWater point 10 minutes newer than the latest completed database poll; this was classified as SOURCE_NEWER, not a value mismatch. The following scheduled poll completed successfully at 14:30:03 ICT.

Source: [ThaiWater public water-level endpoint](https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load), retrieved 2026-08-18.

## 4. Public read-only security

All four Water Tracker tables have RLS enabled and are in supabase_realtime:

- water_tracker_sites
- water_tracker_readings
- water_tracker_alerts
- water_tracker_ingestion_runs

For both anon and authenticated:

- SELECT: granted
- INSERT: denied
- UPDATE: denied
- DELETE: denied

Production probes at 2026-08-18 14:22:05 ICT:

| Probe | HTTP status | Gate |
|---|---:|---|
| Public REST read | 200 | PASS |
| Public REST write to a non-existent row | 401 | PASS |
| Poll without secret | 401 | PASS |
| Backfill without secret | 401 | PASS |
| Backfill with wrong HTTP method | 405 | PASS |

The service_role key is not present in GitHub, browser code or deliverables. Server-side writes use Supabase Edge Function environment credentials; scheduler/backfill authorization uses a separate Vault secret.

Reference controls: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), checked 2026-08-18.

## 5. Realtime and datum semantics

- “Realtime” means immediate browser refresh after a Supabase database event. It does **not** mean every station measures continuously.
- Station freshness is calculated from each station’s observed cadence instead of a fabricated universal interval.
- The dashboard shows ThaiWater station telemetry, not an on-site sensor.
- Derived design scale is shown only when the station MSL datum and project datum have a documented transformation.
- บึงกาฬ uses local datum; design-level comparison is blocked in the UI.
- อ่างทอง can show DELAYED while the application and ingestion pipeline are healthy when the upstream station publishes less frequently.

## 6. Deployment

| Target | Result | Evidence date |
|---|---|---|
| GitHub master | application commit ef8b77a pushed | 2026-08-18 |
| Vercel samco-water-tracker | deployment success | 2026-08-18 14:29 ICT |
| Canonical production domain | HTTP 200 + release marker present | 2026-08-18 14:29 ICT |
| Vercel water-tracker-samco | duplicate integration also deployed successfully | 2026-08-18 14:29 ICT |

There are two Vercel project integrations connected to the same repository. The canonical production domain remains samco-water-tracker.vercel.app. Do not delete the duplicate project until its aliases/ownership are reviewed; deletion is not required for current availability.

## 7. Production gate

**READY** for public read-only operational use.

This is not a guarantee of 100% upstream availability. The first external fail mode is ThaiWater delay/outage; the system handles it by retaining the last verified reading and changing the freshness state instead of pretending stale data is live.

