// Supabase Edge Function: water-tracker-poll
// The scheduler supplies a 64-character secret. Public keys cannot invoke writes.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const THAIWATER_URL =
  "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load";
const MIN_POLL_INTERVAL_MS = 8 * 60 * 1000;

interface Site {
  id: string;
  station_id: number | null;
  datum_offset: number;
  datum_offset_local: boolean;
  alert_warn_design_level: number | null;
  alert_crit_design_level: number | null;
}

interface NormalizedReading {
  measured_at: string;
  wl_msl: number;
  raw: Record<string, unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "unknown_error";
}

function normalizeThaiTimestamp(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).trim();
  const localMatch = text.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/,
  );
  if (localMatch) {
    return `${localMatch[1]}T${localMatch[2]}:${localMatch[3] ?? "00"}+07:00`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeStation(
  row: Record<string, unknown>,
): [number, NormalizedReading] | null {
  const station = (row.station ?? {}) as Record<string, unknown>;
  const stationId = Number(station.id);
  const wlMsl = Number(row.waterlevel_msl ?? row.value);
  const measuredAt = normalizeThaiTimestamp(
    row.waterlevel_datetime ?? row.datetime ?? row.time,
  );
  if (!Number.isFinite(stationId) || !Number.isFinite(wlMsl) || !measuredAt) {
    return null;
  }
  return [stationId, { measured_at: measuredAt, wl_msl: wlMsl, raw: row }];
}

async function fetchThaiWater(): Promise<Map<number, NormalizedReading>> {
  const response = await fetch(THAIWATER_URL, {
    headers: { "User-Agent": "SAMCO-water-tracker/3.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`ThaiWater HTTP ${response.status}`);
  const payload = await response.json();
  const sourceRows = payload?.waterlevel_data?.data;
  if (!Array.isArray(sourceRows)) {
    throw new Error("ThaiWater response shape changed");
  }
  const stations = new Map<number, NormalizedReading>();
  for (const candidate of sourceRows) {
    if (!candidate || typeof candidate !== "object") continue;
    const normalized = normalizeStation(candidate as Record<string, unknown>);
    if (normalized) stations.set(normalized[0], normalized[1]);
  }
  return stations;
}

async function authorize(
  supabase: any,
  request: Request,
) {
  const cronSecret = request.headers.get("x-samco-cron-secret");
  if (!cronSecret) return false;
  const { data, error } = await supabase.rpc("water_tracker_verify_cron_secret", {
    p_secret: cronSecret,
  });
  if (error) throw error;
  return data === true;
}

async function startRun(supabase: any) {
  const { data, error } = await supabase
    .from("water_tracker_ingestion_runs")
    .insert({ run_type: "poll", status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return Number(data.id);
}

async function finishRun(
  supabase: any,
  runId: number,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("water_tracker_ingestion_runs")
    .update({ completed_at: new Date().toISOString(), ...values })
    .eq("id", runId);
  if (error) console.error("failed to update ingestion run", error);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let runId: number | null = null;

  try {
    if (!(await authorize(supabase, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const { data: lastPoll, error: lastPollError } = await supabase
      .from("water_tracker_readings")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastPollError) throw lastPollError;
    const lastFetchedAt = lastPoll?.fetched_at
      ? new Date(lastPoll.fetched_at).getTime()
      : 0;
    const ageMs = Date.now() - lastFetchedAt;
    if (lastFetchedAt && ageMs >= 0 && ageMs < MIN_POLL_INTERVAL_MS) {
      return json({
        ok: true,
        skipped: "cooldown",
        retry_after_seconds: Math.ceil((MIN_POLL_INTERVAL_MS - ageMs) / 1000),
      });
    }

    runId = await startRun(supabase);
    const { data: sites, error: sitesError } = await supabase
      .from("water_tracker_sites")
      .select(
        "id, station_id, datum_offset, datum_offset_local, alert_warn_design_level, alert_crit_design_level",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (sitesError) throw sitesError;

    const stationReadings = await fetchThaiWater();
    const readingRows: Record<string, unknown>[] = [];
    const skipped: Record<string, unknown>[] = [];
    for (const site of (sites ?? []) as Site[]) {
      if (!site.station_id) {
        skipped.push({ site_id: site.id, reason: "no_station" });
        continue;
      }
      const reading = stationReadings.get(Number(site.station_id));
      if (!reading) {
        skipped.push({ site_id: site.id, reason: "no_data" });
        continue;
      }
      readingRows.push({
        site_id: site.id,
        station_id: Number(site.station_id),
        measured_at: reading.measured_at,
        wl_msl: reading.wl_msl,
        wl_design: site.datum_offset_local
          ? null
          : reading.wl_msl + Number(site.datum_offset),
        source: "thaiwater_v3",
        raw: reading.raw,
      });
    }
    if (!readingRows.length) throw new Error("no_station_data");

    const { data: persisted, error: readingsError } = await supabase
      .from("water_tracker_readings")
      .upsert(readingRows, {
        onConflict: "site_id,station_id,measured_at",
        ignoreDuplicates: false,
      })
      .select("id, site_id, wl_msl, wl_design, measured_at");
    if (readingsError) throw readingsError;

    const siteById = new Map(
      ((sites ?? []) as Site[]).map((site) => [site.id, site]),
    );
    const alerts: Record<string, unknown>[] = [];
    for (const reading of persisted ?? []) {
      const site = siteById.get(reading.site_id);
      if (!site) continue;
      const value = site.datum_offset_local
        ? Number(reading.wl_msl)
        : Number(reading.wl_design);
      const critical = site.alert_crit_design_level == null
        ? null
        : Number(site.alert_crit_design_level);
      const warning = site.alert_warn_design_level == null
        ? null
        : Number(site.alert_warn_design_level);
      let level: "crit" | "warn" | null = null;
      let threshold: number | null = null;
      if (critical !== null && value >= critical) {
        level = "crit";
        threshold = critical;
      } else if (warning !== null && value >= warning) {
        level = "warn";
        threshold = warning;
      }
      if (level && threshold !== null) {
        alerts.push({
          site_id: site.id,
          level,
          wl_msl: Number(reading.wl_msl),
          wl_design: reading.wl_design == null
            ? null
            : Number(reading.wl_design),
          threshold,
          threshold_kind: site.datum_offset_local ? "msl" : "design",
          message: `WL ${value.toFixed(2)} >= ${level} threshold ${threshold}`,
          reading_id: reading.id,
        });
      }
    }
    if (alerts.length) {
      const { error: alertsError } = await supabase
        .from("water_tracker_alerts")
        .upsert(alerts, {
          onConflict: "reading_id,level",
          ignoreDuplicates: true,
        });
      if (alertsError) throw alertsError;
    }

    const sourceLatestAt = (persisted ?? [])
      .map((row) => new Date(row.measured_at).getTime())
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0);
    await finishRun(supabase, runId, {
      status: "success",
      active_sites: sites?.length ?? 0,
      processed_readings: persisted?.length ?? 0,
      alert_count: alerts.length,
      skipped,
      source_latest_at: sourceLatestAt
        ? new Date(sourceLatestAt).toISOString()
        : null,
    });
    return json({
      ok: true,
      run_id: runId,
      active_sites: sites?.length ?? 0,
      processed_readings: persisted?.length ?? 0,
      alerts: alerts.length,
      skipped,
    });
  } catch (error) {
    console.error("water-tracker-poll failed", error);
    if (runId !== null) {
      await finishRun(supabase, runId, {
        status: "failed",
        error_message: errorText(error),
      });
    }
    return json({ ok: false, error: errorText(error) }, 500);
  }
});
