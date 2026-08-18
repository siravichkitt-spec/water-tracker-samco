-- SAMCO Water Level Tracker — Supabase schema
-- Project: yiyoagypmcnatdauuadf
-- Generated 2026-08-18

-- ============================================================
-- TABLE: water_tracker_sites
-- ============================================================
CREATE TABLE public.water_tracker_sites (
  id                        text PRIMARY KEY,
  name                      text NOT NULL,
  project_ref               text,
  lat                       numeric NOT NULL,
  lng                       numeric NOT NULL,
  maps_url                  text,
  river                     text,
  length_m                  numeric,
  station_id                bigint,
  station_code              text,
  station_name              text,
  station_distance_km       numeric,
  station_bank_msl          numeric,
  station_note              text,
  datum_offset              numeric NOT NULL DEFAULT 0,
  datum_offset_source       text,
  datum_warning             text,
  datum_offset_local        boolean NOT NULL DEFAULT false,
  design_levels             jsonb DEFAULT '[]'::jsonb,       -- [{label, value, color, kind}]
  reference_water_levels    jsonb DEFAULT '[]'::jsonb,       -- [{label, value, color}]
  alert_warn_design_level   numeric,
  alert_crit_design_level   numeric,
  sort_order                integer NOT NULL DEFAULT 0,
  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: water_tracker_readings
-- ============================================================
CREATE TABLE public.water_tracker_readings (
  id            bigserial PRIMARY KEY,
  site_id       text NOT NULL REFERENCES water_tracker_sites(id) ON DELETE CASCADE,
  station_id    bigint NOT NULL,
  measured_at   timestamptz NOT NULL,
  wl_msl        numeric NOT NULL,
  wl_design     numeric,
  source        text NOT NULL DEFAULT 'thaiwater_v3',
  raw           jsonb,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, station_id, measured_at)
);

CREATE INDEX idx_water_tracker_readings_site_time
  ON public.water_tracker_readings (site_id, measured_at DESC);

-- ============================================================
-- TABLE: water_tracker_alerts
-- ============================================================
CREATE TABLE public.water_tracker_alerts (
  id                bigserial PRIMARY KEY,
  site_id           text NOT NULL REFERENCES water_tracker_sites(id) ON DELETE CASCADE,
  triggered_at      timestamptz NOT NULL DEFAULT now(),
  level             text NOT NULL,               -- 'warn' | 'crit'
  wl_msl            numeric NOT NULL,
  wl_design         numeric,
  threshold         numeric NOT NULL,
  threshold_kind    text NOT NULL,               -- 'msl' | 'design'
  message           text,
  reading_id        bigint REFERENCES water_tracker_readings(id) ON DELETE SET NULL,
  acknowledged_at   timestamptz,
  acknowledged_by   text
);

-- ============================================================
-- RPC: water_tracker_bucket
-- Server-side time-bucket aggregation for long-range charts.
-- Bypasses PostgREST 1000-row cap.
-- ============================================================
CREATE OR REPLACE FUNCTION water_tracker_bucket(
  p_site        text,
  p_start       timestamptz,
  p_end         timestamptz,
  p_bucket_mins int
) RETURNS TABLE(measured_at timestamptz, wl_msl numeric, wl_design numeric)
  LANGUAGE sql STABLE AS $$
    SELECT
      to_timestamp(floor(extract(epoch FROM measured_at) / (p_bucket_mins * 60))
                   * (p_bucket_mins * 60)) AT TIME ZONE 'UTC' AS measured_at,
      AVG(wl_msl)::numeric   AS wl_msl,
      AVG(wl_design)::numeric AS wl_design
    FROM water_tracker_readings
    WHERE site_id = p_site
      AND measured_at >= p_start
      AND measured_at <= p_end
    GROUP BY 1
    ORDER BY 1 ASC
$$;

GRANT EXECUTE ON FUNCTION water_tracker_bucket(text, timestamptz, timestamptz, int)
  TO anon, authenticated;

-- ============================================================
-- RLS (currently DISABLED — anon can read all tables via publishable key)
-- If enabling RLS later:
--   ALTER TABLE water_tracker_sites ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "public read sites" ON water_tracker_sites FOR SELECT USING (true);
--   (repeat for readings + alerts)
-- ============================================================

-- ============================================================
-- pg_cron job (schedule in cron.job table)
-- Job: water-tracker-poll-15min · schedule: */15 * * * *
-- ============================================================
-- SELECT cron.schedule('water-tracker-poll-15min', '*/15 * * * *', $$
--   SELECT net.http_get(
--     url := 'https://yiyoagypmcnatdauuadf.supabase.co/functions/v1/water-tracker-poll',
--     headers := jsonb_build_object(
--       'x-samco-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='water_tracker_cron_secret' LIMIT 1),
--       'Content-Type', 'application/json'
--     ),
--     timeout_milliseconds := 60000
--   );
-- $$);
