// water-tracker-poll: fetch current ThaiWater readings for all active sites,
// upsert to water_tracker_readings, and check alert thresholds.
// Invoke via cron (Supabase Scheduler) every 15 minutes, or GET manually.
// Auth: JWT disabled — this uses SERVICE_ROLE_KEY internally to write.
//
// Signature:
//   GET /functions/v1/water-tracker-poll   -> polls all active sites
//   GET /functions/v1/water-tracker-poll?site=<id>  -> single site

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const THAI_BASE = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public";

interface Site {
  id: string;
  station_id: number | null;
  datum_offset: number;
  datum_offset_local: boolean;
  alert_warn_design_level: number | null;
  alert_crit_design_level: number | null;
}

interface Reading {
  measured_at: string;
  wl_msl: number;
}

async function fetchLatestForStation(stationId: number): Promise<Reading | null> {
  // /waterlevel_load returns all stations - filter
  const r = await fetch(`${THAI_BASE}/waterlevel_load`, {
    headers: { "User-Agent": "SAMCO-water-tracker/1.0" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const arr = j?.waterlevel_data?.data ?? [];
  const hit = arr.find((s: any) => Number(s?.station?.id) === Number(stationId));
  if (!hit) return null;
  const wl = Number(hit.waterlevel_msl ?? hit.value ?? NaN);
  const t = hit.waterlevel_datetime ?? hit.datetime ?? hit.time;
  if (!Number.isFinite(wl) || !t) return null;
  // Thai API returns local time strings like "2026-08-08 09:30" — treat as +07:00
  const iso = String(t).replace(" ", "T").slice(0, 16) + ":00+07:00";
  return { measured_at: iso, wl_msl: wl };
}

async function processSite(sb: ReturnType<typeof createClient>, site: Site) {
  if (!site.station_id) return { site_id: site.id, skipped: "no_station" };
  const r = await fetchLatestForStation(site.station_id);
  if (!r) return { site_id: site.id, skipped: "no_data" };

  const wl_design = site.datum_offset_local ? null : r.wl_msl + Number(site.datum_offset);

  // upsert reading
  const { data: reading, error: e1 } = await sb
    .from("water_tracker_readings")
    .upsert(
      {
        site_id: site.id,
        station_id: site.station_id,
        measured_at: r.measured_at,
        wl_msl: r.wl_msl,
        wl_design,
        source: "thaiwater_v3",
      },
      { onConflict: "site_id,station_id,measured_at", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (e1) return { site_id: site.id, error: e1.message };

  // Alert check (only if not local datum)
  const alerts: any[] = [];
  const check = (threshold: number | null, level: "warn" | "crit") => {
    if (threshold == null) return;
    const val = site.datum_offset_local ? r.wl_msl : (wl_design as number);
    const kind = site.datum_offset_local ? "msl" : "design";
    if (val >= threshold) {
      alerts.push({
        site_id: site.id,
        level,
        wl_msl: r.wl_msl,
        wl_design,
        threshold,
        threshold_kind: kind,
        message: `WL ${val.toFixed(2)} >= ${level} threshold ${threshold} (${kind} scale)`,
        reading_id: reading?.id,
      });
    }
  };
  check(site.alert_crit_design_level, "crit");
  check(site.alert_warn_design_level, "warn");

  if (alerts.length > 0) {
    await sb.from("water_tracker_alerts").insert(alerts);
  }

  return { site_id: site.id, wl_msl: r.wl_msl, wl_design, alerts: alerts.length };
}

Deno.serve(async (req: Request) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const single = url.searchParams.get("site");

  let query = sb
    .from("water_tracker_sites")
    .select("id, station_id, datum_offset, datum_offset_local, alert_warn_design_level, alert_crit_design_level")
    .eq("is_active", true);
  if (single) query = query.eq("id", single);

  const { data: sites, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results = [];
  for (const s of (sites ?? []) as Site[]) {
    results.push(await processSite(sb, s));
  }

  return new Response(JSON.stringify({ ok: true, count: results.length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
