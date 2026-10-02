# SAMCO Water Level Tracker

Public read-only, source-driven near-real-time monitoring for SAMCO LOGISTICS bank-protection project sites.

- Production: https://samco-water-tracker.vercel.app
- Data owner: Supabase project `samco-logistics` (`yiyoagypmcnatdauuadf`)
- Upstream sources: ThaiWater public API and RID Big Data historical/telemetry API
- Frontend: static HTML, Chart.js, Supabase JS
- Ingestion: protected Supabase Edge Functions called by `pg_cron`
- Realtime: Supabase Postgres Changes with a timed fallback read

The dashboard displays measurements at the configured station from the freshest validated authoritative feed. A station value is not represented as an on-site sensor measurement. Design-scale comparisons are disabled whenever the source and project datums are incompatible.

## Security model

- `anon` and `authenticated`: `SELECT` only on `water_tracker_*` public tables.
- `service_role`: server-side Edge Functions only; never committed or sent to the browser.
- `water-tracker-poll` and `water-tracker-backfill`: require the scheduler secret stored in Supabase Vault.
- RLS is enabled on every exposed water tracker table.

## Repository layout

- `index.html` — production dashboard
- `edge-function-poll.ts` — scheduled current-reading ingestion
- `edge-function-backfill.ts` — protected historical maintenance endpoint
- `supabase/migrations/` — tracked database changes
- `supabase-schema.sql` — readable schema reference
- `HANDOFF.md` — operations, verification, and release runbook

No secret or service-role key belongs in this repository.

## Animated typical sections (2026-10-02)

The owner requested the original vector/animated presentation, not scanned PDF images. Every component in the authored registry has a visible, interactive SVG marker and detail/source/elevation inspector. Actual station readings and timestamps are shown inside the image. Source-linked spot levels use the numeric vertical axis; other geometry is explicitly schematic. Unknown pile cut-off/toe and ground elevations are never fabricated.

There are 18 typical/detail sections (201 component occurrences), plus 76 selectable Buengkan surveyed-profile references. These profile graphics reuse typical topology and are explicitly NOT digitized surveyed ground. Counts including repeated profile components are 94 entries / 1265 occurrences / 184 spot-level occurrences, not unique construction quantities.

- `typical-sections.js` — authored drawing transcription and bundled fallback
- `typical-ui.js` — section selection, component inspector and PDF references only
- `section-animation.js` — SVG topology, actual-water overlay and freshness-aware waves
- `buengkan-details.js` — full drawing detail transcription and profile catalog
- `assets/typical/` — original PDFs, rendered pages, SHA256 manifest
- `sites/typical-sections.json` — synchronized structured inventory
- `water_tracker_sites.typical_sections` — public read-only Supabase data
- `outputs/typical_sections_water_tracker_v01_20261001/` — drawing review and metadata recovery

Run `node --test typical-sections.test.js section-animation.test.js` and `node scripts/verify_typical_database.js`. Selecting a section changes the KPI/chart/statistics reference levels; all section inventories are accessible. Buengkan local datum remains isolated: its station reading is shown INSIDE the image on a separate scale, never as an overlay/freeboard. As checked 2026-10-02, its latest database reading is 2026-09-14 09:00 Bangkok, correctly shown STALE, not LIVE.

Metadata update and recovery SQL is in `outputs/section_animation_v01_20261002/`. Ingestion, telemetry, calibration, gauges, coordinates, thresholds, RLS and public SELECT-only grants were not changed. The unsubstantiated old Buengkan offset estimate was removed from its warning text.
