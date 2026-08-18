# SAMCO Water Level Tracker — Codex Handoff

Live URL: https://samco-water-tracker.vercel.app
GitHub: https://github.com/siravichkitt-spec/water-tracker-samco (auto-deploy to Vercel on push to `master`)
Owner: siravichkitt@gmail.com

## Purpose
Real-time water-level monitoring for 5 SAMCO Logistics river-bank protection project sites (all Thai government contracts). Data from ThaiWater API (สสน. — Hydro Informatics Institute) via `api-v3.thaiwater.net`.

## Stack
- Frontend: Static HTML + Chart.js v4.4.0 + Supabase JS SDK v2 (all via CDN, no build step)
- Backend: Supabase (Postgres + Edge Functions + pg_cron)
- Deploy: Vercel (auto-deploy from GitHub `master`)
- Data source: ThaiWater API v3 (public, no auth)

## Supabase project
- Project ID: `yiyoagypmcnatdauuadf`
- URL: `https://yiyoagypmcnatdauuadf.supabase.co`
- Publishable anon key (safe for browser): `sb_publishable_QLWNOTvjiait7wY7_v5IpA_P4KstVeh`
- Service role key: **[ต้องกรอก]** — เก็บใน Supabase Dashboard > Settings > API (ใช้เฉพาะ Edge Function เท่านั้น, ห้ามส่งไป browser)

## Tables (schema in `supabase-schema.sql`)
- `water_tracker_sites` — 5 sites config (station_id, datum_offset, design_levels JSONB, alert thresholds)
- `water_tracker_readings` — time-series (site_id, station_id, measured_at, wl_msl, wl_design)
- `water_tracker_alerts` — triggered when wl exceeds threshold (level: warn/crit)

## Edge Functions
- `water-tracker-poll` — fetches ThaiWater `/waterlevel_load` (all 1400+ stations), filters to 5 sites, upserts readings, checks alert thresholds. Called by pg_cron every 15 min.
- `water-tracker-backfill` — accepts `?days=N&site=<id>`, fetches ThaiWater `/waterlevel_graph` history (chunked, up to 365 days), upserts in batches of 1000.

## pg_cron
Job `water-tracker-poll-15min`: `*/15 * * * *` → calls `water-tracker-poll` via `net.http_get` with `x-samco-cron-secret` header (secret in `vault.decrypted_secrets`).

## RPC functions
- `water_tracker_bucket(p_site text, p_start timestamptz, p_end timestamptz, p_bucket_mins int)` — server-side time-bucket aggregation. Used by frontend `fetchRangeFromDB()` when span > 45 days to bypass PostgREST 1000-row cap. Returns bucketed avg wl_msl/wl_design.

## Sites (5)
| Site ID | Name | Station ID | Station Code | Offset | Update Frequency |
|---|---|---|---|---|---|
| thachin-nakhonchaisi | นครชัยศรี (ท่าจีน) | 748 | THA008 | +96.691 | 15-30 min |
| khoksalut-nan | โคกสลุด (น่าน) | 667 | NAN006 | +59.777 | 15-30 min |
| angthong-bangkaew | อ่างทอง (คลองบางแก้ว) | 2626 | C.7A | +91.421 | hourly |
| prachinburi | ปราจีนบุรี | 2680 | Kgt.3 | +91.000 | hourly |
| buengkan-nam-hi | บึงกาฬ (แม่น้ำฮี้) | 11688687 | TKS.121 | 0 (local datum) | hourly, no historical |

## Frontend architecture (`index.html`)
Single-file app (~980 lines). Key functions:
- `loadSitesFromSupabase()` — reads `water_tracker_sites` table on boot
- `dbRowToSite()` — maps snake_case DB row → camelCase UI object (⚠️ `Number(row.station_id)` because Postgres bigint returns as string in JS SDK)
- `fetchLatestReadingFromDB(siteId)` — reads latest row from `water_tracker_readings`
- `fetchRangeFromDB(siteId, startISO, endISO)` — reads range; uses RPC `water_tracker_bucket` for spans > 45 days
- `renderKPIs()` — 4 cards: current WL, change, distance to crest, distance to pile top
- `renderCrossSection()` — SVG cross-section with live water line + design levels
- `renderRecentChart()` — 3-day chart (raw rows)
- `renderHistoricalChart(days)` — dynamic x-axis unit (hour/day/week/month), server-side bucket for >180d
- Auto-refresh: `setInterval(loadSite, 60_000)` — every 60s

## Known issues / limitations
1. **Buengkan (station 11688687)** — ThaiWater `/waterlevel_graph` returns null historical data. Only accumulates via cron (1 hourly reading per hour). Cannot backfill.
2. **Datum offsets** — 4/5 sites verified against BM markers; angthong/prachinburi need site-visit verification. Buengkan uses local datum (not MSL) — chart shows ThaiWater's MSL scale directly, ห้าม compare กับ design levels ตรงๆ.
3. **CORS**: ThaiWater API allows cross-origin requests, but historical (`/waterlevel_graph`) sometimes hangs from browser. Frontend reads from Supabase DB instead (populated by cron + backfill).
4. **PostgREST 1000-row cap** — cannot return >1000 rows even with `.limit(10000)`. Long-range queries MUST use RPC bucket function.

## Backfill runbook (already done: 365 days for 4 sites, 119,360 rows)
```bash
# Manually backfill one site (Edge Function has 60s timeout, chunks internally):
curl -X POST "https://yiyoagypmcnatdauuadf.supabase.co/functions/v1/water-tracker-backfill?days=365&site=thachin-nakhonchaisi" \
  -H "Authorization: Bearer sb_publishable_QLWNOTvjiait7wY7_v5IpA_P4KstVeh"
```

## Deploy workflow
```bash
git add -A && git commit -m "..." && git push
# → Vercel auto-deploys to https://samco-water-tracker.vercel.app in ~90s
```

## Suggested next tasks for Codex
1. **Alert UI** — display recent `water_tracker_alerts` rows on dashboard (table exists but no UI).
2. **Multi-site overview page** — grid card view showing all 5 sites current WL + status color (green/warn/crit).
3. **Email/LINE notifications** — trigger from Edge Function when new alert row inserted.
4. **Historical comparison** — overlay y-o-y trace (this year vs last year on same chart).
5. **Site admin CRUD** — edit `water_tracker_sites` from UI (currently must edit via SQL).
6. **Verify auto-refresh** — after Vercel picks up latest commit `2c62900`, confirm green pulse dot + "(X นาที ที่แล้ว)" age counter in header.

## Testing
No test framework installed. Manual QA via `browser_task` / Playwright screenshots.

## Iron rules (from user, ห้ามละเมิด)
1. ห้ามเดาตัวเลข — ใช้ `[ต้องกรอก]` เมื่อไม่มีข้อมูล
2. Verify ตัวเลขซ้ำ — ผลรวมไม่ตรง = หยุดและแจ้ง
3. ตัวเลขระบุ SAMCO LOGISTICS vs สามัคคี (โครงการทั้ง 5 site เป็นของ SAMCO LOGISTICS)
4. ASCII filenames only
5. Deliverable: .md / .xlsx live formula / .docx+.pdf
