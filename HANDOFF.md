# SAMCO Water Level Tracker — Operations Handoff

**Version:** v3

**Verified:** 2026-08-18

**Entity:** SAMCO LOGISTICS — (ก) แพนสั่งได้เอง

**Production:** https://samco-water-tracker.vercel.app
**GitHub:** https://github.com/siravichkitt-spec/water-tracker-samco

## Source of truth

The water tracker is stored in the Supabase project named `samco-logistics`, project ref `yiyoagypmcnatdauuadf`, region `ap-northeast-2`. It is separate from the Supabase project named `samakee`.

Data path:

```text
ThaiWater public API
  -> protected water-tracker-poll Edge Function
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
- Creates at most one severity per reading and logs ingestion health.

### `water-tracker-backfill`

- Maintenance only; `POST` plus the same scheduler secret.
- `days` must be an integer from 1 through 365.
- Optional `site=<site_id>` restricts the maintenance run.
- A publishable key is never sufficient to invoke it.

To invoke a backfill without copying the secret out of Vault, run this inside the Supabase SQL editor and change only the non-secret query parameters:

```sql
select net.http_post(
  url := 'https://yiyoagypmcnatdauuadf.supabase.co/functions/v1/water-tracker-backfill?days=30&site=thachin-nakhonchaisi',
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

## Dashboard semantics

- `LIVE`, `DELAYED`, and `STALE` derive from the median interval of recent readings at that station.
- Change is calculated from the previous stored reading. If none exists, the UI says there is no prior reading; it never substitutes zero.
- The page shows the source timestamp, database receipt time, station identity, and ingestion health.
- Buengkan uses a local project datum that is incompatible with ThaiWater MSL. Design conversion, distance-to-crest, distance-to-pile, reference overlays, and related alerts must remain disabled until field calibration supplies an approved conversion.
- Every site uses a nearby/proxy gauge unless a field sensor is explicitly installed. The UI must never relabel a station measurement as an on-site measurement.

## Verification checklist

1. Confirm the Supabase project name is `samco-logistics` and ref is `yiyoagypmcnatdauuadf`.
2. Confirm all public water tracker tables have RLS enabled and public roles have SELECT only.
3. Call both Edge Function URLs without the scheduler secret; expect `401` for the allowed HTTP method.
4. Confirm `water_tracker_readings` and `water_tracker_ingestion_runs` are in the `supabase_realtime` publication.
5. Compare the latest timestamp and `wl_msl` for all configured stations against ThaiWater.
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
3. Compare one station directly with ThaiWater.
4. Check `cron.job` and recent `cron.job_run_details`.
5. If upstream is stale, leave the last valid reading intact and keep the dashboard marked `STALE`; never insert a made-up replacement.

## Credential rule

Never place a service-role key, scheduler secret, Vercel token, or GitHub token in this file, source code, browser code, issue, commit, or chat output.
