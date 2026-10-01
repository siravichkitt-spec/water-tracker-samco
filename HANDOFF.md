# SAMCO Water Level Tracker — Operations Handoff

**Version:** v5 (typical sections)

**Verified:** 2026-10-01 (typical sections; ingestion implementation unchanged)

**Entity:** SAMCO LOGISTICS — (ก) แพนสั่งได้เอง

**Production:** https://samco-water-tracker.vercel.app
**GitHub:** https://github.com/siravichkitt-spec/water-tracker-samco

## Source of truth

### Typical-section release

Owner approved the new PDF set and confirmed the Prachinburi drawing belongs to the existing site. `water_tracker_sites.typical_sections` contains all six sections, 93 component records, 18 explicit levels, source references and hashes. The full review/recovery files are in `outputs/typical_sections_water_tracker_v01_20261001/`.

Thachin has two distinct crests (100.000 and 99.200); Angthong's approved crest is 99.000, not the legacy 96.500. Critical thresholds use the lowest explicit crest for compatible-datum sites. Existing operational warning thresholds, all telemetry, gauges, coordinates and datum offsets are unchanged. Never treat @ pile spacing as a cut-off elevation. Never derive unknown component elevations from image pixels or pile length. Request the referenced standard/detail drawings to fill the missing fields.

The water tracker is stored in the Supabase project named `samco-logistics`, project ref `yiyoagypmcnatdauuadf`, region `ap-northeast-2`. It is separate from the Supabase project named `samakee`.

Data path:

```text
ThaiWater public API -> protected water-tracker-poll Edge Function
RID Big Data historical API -> protected water-tracker-backfill Edge Function
  -> validated station identity/value/timestamp
  -> SAMCO LOGISTICS Supabase Postgres
  -> RLS public SELECT-only API + Supabase Realtime
  -> Vercel public dashboard
```

The upstream source publishes on its own cadence. Realtime means a new database row is pushed to the browser immediately; it does not mean the gauge measures every second.

## Public data contract

| Object | Public access | Server access |
|---|---|---|
| `water_tracker_sites` | SELECT active sites | full via service role |
| `water_tracker_readings` | SELECT | full via service role |
| `water_tracker_alerts` | SELECT | full via service role |
| `water_tracker_ingestion_runs` | SELECT operational health | full via service role |
| `water_tracker_bucket(...)` | EXECUTE for chart reads | EXECUTE |
| `water_tracker_verify_cron_secret(...)` | none | EXECUTE by service role only |

RLS is enabled on all four exposed tables. The public roles have no INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, or REFERENCES grant.

## Edge Functions

### `water-tracker-poll`

- Called by `pg_cron` every 15 minutes.
- Requires `x-samco-cron-secret`; the secret is read by the scheduler from Supabase Vault.
- Fetches ThaiWater once, filters configured stations, validates values/timestamps, and upserts idempotently.
- For RID telemetry codes (`TKS.*`), also reads the official RID Big Data feed and persists whichever authoritative reading has the newest source timestamp. This keeps TKS.121 current when the ThaiWater live mirror is stale.
- Rejects `null`, blank, non-numeric, and timezone-free RID values; a missing value is never converted to zero.
- Creates at most one severity per reading and logs ingestion health.

### `water-tracker-backfill`

- Maintenance only; `POST` plus the same scheduler secret.
- `days` must be an integer from 1 through 365.
- Optional `site=<site_id>` restricts the maintenance run.
- Defaults to a read-only dry run. It fetches and validates the source but writes neither readings nor an ingestion run.
- A write requires the explicit query parameter `write=true`. Source validation is all-or-nothing: if any selected site has no valid values, no readings are written.
- Reads historical telemetry from the official RID Big Data station endpoint using each configured `station_code`.
- Station identity mismatches, `null`, blank, non-numeric, timezone-free/invalid timestamps, and conflicting duplicate values are rejected; `null` is never converted to zero.
- A publishable key is never sufficient to invoke it.

First run this dry run without copying the secret out of Vault. Change only the non-secret query parameters:

```sql
select net.http_post(
  url := 'https://yiyoagypmcnatdauuadf.supabase.co/functions/v1/water-tracker-backfill?days=365&site=buengkan-nam-hi',
  headers := jsonb_build_object(
    'x-samco-cron-secret', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'water_tracker_cron_secret'
      limit 1
    ),
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
);
```

Only after the response says both `ok: true` and `safe_to_write: true`, invoke the same URL with `&write=true`. A `422` response with `source_has_no_valid_water_level_values` means the upstream historical endpoint has timestamps but no usable readings; leave production data unchanged and escalate the source gap.

## Dashboard semantics

- `LIVE`, `DELAYED`, and `STALE` derive from the median interval of recent readings at that station.
- Change is calculated from the previous stored reading. If none exists, the UI says there is no prior reading; it never substitutes zero.
- The page shows the source timestamp, database receipt time, station identity, and ingestion health.
- Buengkan uses a local project datum that is incompatible with TKS.121 MSL telemetry. Design conversion, distance-to-crest, distance-to-pile, reference overlays, and related alerts must remain disabled until field calibration supplies an approved conversion.
- Every site uses a nearby/proxy gauge unless a field sensor is explicitly installed. The UI must never relabel a station measurement as an on-site measurement.

## Verification checklist

1. Confirm the Supabase project name is `samco-logistics` and ref is `yiyoagypmcnatdauuadf`.
2. Confirm all public water tracker tables have RLS enabled and public roles have SELECT only.
3. Call both Edge Function URLs without the scheduler secret; expect `401` for the allowed HTTP method.
4. Confirm `water_tracker_readings` and `water_tracker_ingestion_runs` are in the `supabase_realtime` publication.
5. Compare the latest timestamp and `wl_msl` for all configured stations against their configured authoritative feed (ThaiWater and RID Big Data for `TKS.*`).
6. Confirm `water_tracker_ingestion_runs` reports a recent successful poll.
7. Open production, switch all sites, switch MSL/design scale, and verify Buengkan cannot select design scale.
8. Confirm no browser console error and no service-role/cron secret in HTML, Git, or logs.

## Release workflow

1. Run syntax and security checks locally.
2. Apply the tracked Supabase migration.
3. Deploy both Edge Functions with custom secret authentication (`verify_jwt=false` because the handler validates the scheduler secret).
4. Verify unauthorized calls and trigger one authorized poll from the database scheduler path.
5. Deploy a Vercel preview and complete browser QA.
6. Push the verified commit to `master`; the connected Vercel project auto-deploys production.
7. Compare production content with GitHub and perform the verification checklist again.

## Incident order

1. Check `water_tracker_ingestion_runs` for the last status and error.
2. Check Supabase Edge Function logs for `water-tracker-poll`.
3. Compare one station directly with its authoritative upstream source.
4. Check `cron.job` and recent `cron.job_run_details`.
5. If upstream is stale, leave the last valid reading intact and keep the dashboard marked `STALE`; never insert a made-up replacement.

## Credential rule

Never place a service-role key, scheduler secret, Vercel token, or GitHub token in this file, source code, browser code, issue, commit, or chat output.
