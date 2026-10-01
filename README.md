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

## Typical sections (2026-10-01)

Owner-approved drawings now provide six sections across five sites, 93 component records and 18 explicit spot elevations. Both Thachin sections remain visible; Nan includes its pile plan and both chainage-based pile lengths. The UI uses original drawings with zoom, not a fabricated generic cross-section. Missing elevations/details are explicitly marked and never inferred from image pixels or pile lengths.

- `typical-sections.js` — authored drawing transcription and bundled fallback
- `typical-ui.js` — full component inventory and source-linked drawing viewer
- `assets/typical/` — original PDFs, rendered pages, SHA256 manifest
- `sites/typical-sections.json` — synchronized structured inventory
- `water_tracker_sites.typical_sections` — public read-only Supabase data
- `outputs/typical_sections_water_tracker_v01_20261001/` — drawing review and metadata recovery

Run `node --test typical-sections.test.js` and `node scripts/verify_typical_database.js` to verify the registry and its public database copy. Selecting a section changes the KPI/chart/statistics reference levels; all section inventories stay visible. Buengkan local datum remains isolated from station MSL.
