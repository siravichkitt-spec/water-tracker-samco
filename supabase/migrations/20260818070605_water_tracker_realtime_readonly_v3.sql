-- SAMCO LOGISTICS water tracker: public read-only + operational health + Realtime.
-- This migration is intentionally scoped to water_tracker_* objects only.

create table if not exists public.water_tracker_ingestion_runs (
  id                    bigserial primary key,
  run_type              text not null check (run_type in ('poll', 'backfill')),
  status                text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  active_sites          integer check (active_sites is null or active_sites >= 0),
  processed_readings    integer check (processed_readings is null or processed_readings >= 0),
  alert_count           integer check (alert_count is null or alert_count >= 0),
  skipped               jsonb not null default '[]'::jsonb check (jsonb_typeof(skipped) = 'array'),
  source_latest_at      timestamptz,
  error_message         text
);

comment on table public.water_tracker_ingestion_runs is
  'SAMCO LOGISTICS water tracker ingestion health; no credentials stored';

create index if not exists idx_water_tracker_ingestion_runs_started_at
  on public.water_tracker_ingestion_runs (started_at desc);

create unique index if not exists uq_water_tracker_alert_reading_level
  on public.water_tracker_alerts (reading_id, level)
  where reading_id is not null;

alter table public.water_tracker_sites enable row level security;
alter table public.water_tracker_readings enable row level security;
alter table public.water_tracker_alerts enable row level security;
alter table public.water_tracker_ingestion_runs enable row level security;

revoke all on table public.water_tracker_sites from anon, authenticated;
revoke all on table public.water_tracker_readings from anon, authenticated;
revoke all on table public.water_tracker_alerts from anon, authenticated;
revoke all on table public.water_tracker_ingestion_runs from anon, authenticated;

grant select on table public.water_tracker_sites to anon, authenticated;
grant select on table public.water_tracker_readings to anon, authenticated;
grant select on table public.water_tracker_alerts to anon, authenticated;
grant select on table public.water_tracker_ingestion_runs to anon, authenticated;

grant all on table public.water_tracker_sites to service_role;
grant all on table public.water_tracker_readings to service_role;
grant all on table public.water_tracker_alerts to service_role;
grant all on table public.water_tracker_ingestion_runs to service_role;
grant usage, select on sequence public.water_tracker_ingestion_runs_id_seq to service_role;

drop policy if exists "public read sites" on public.water_tracker_sites;
create policy "public read sites"
  on public.water_tracker_sites for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "public read readings" on public.water_tracker_readings;
create policy "public read readings"
  on public.water_tracker_readings for select
  to anon, authenticated
  using (true);

drop policy if exists "public read alerts" on public.water_tracker_alerts;
create policy "public read alerts"
  on public.water_tracker_alerts for select
  to anon, authenticated
  using (true);

drop policy if exists "public read ingestion health" on public.water_tracker_ingestion_runs;
create policy "public read ingestion health"
  on public.water_tracker_ingestion_runs for select
  to anon, authenticated
  using (true);

revoke all on function public.water_tracker_verify_cron_secret(text)
  from public, anon, authenticated;
grant execute on function public.water_tracker_verify_cron_secret(text)
  to service_role;

revoke all on function public.water_tracker_bucket(text, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.water_tracker_bucket(text, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'water_tracker_sites',
    'water_tracker_readings',
    'water_tracker_alerts',
    'water_tracker_ingestion_runs'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end;
$$;
