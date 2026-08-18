// Supabase Edge Function: water-tracker-backfill
// Restricted maintenance endpoint. It accepts the scheduler secret, never a public key.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const THAIWATER_GRAPH_URL =
  "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph";

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

function thaiTimestamp(value: unknown): string | null {
  if (!value) return null;
  const match = String(value).trim().match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/,
  );
  if (!match) return null;
  const parsed = new Date(`${match[1]}T${match[2]}:${match[3] ?? "00"}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let runId: number | null = null;

  try {
    const cronSecret = request.headers.get("x-samco-cron-secret");
    if (!cronSecret) return json({ ok: false, error: "unauthorized" }, 401);
    const { data: authorized, error: authError } = await supabase.rpc(
      "water_tracker_verify_cron_secret",
      { p_secret: cronSecret },
    );
    if (authError) throw authError;
    if (authorized !== true) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const daysText = url.searchParams.get("days") ?? "30";
    if (!/^\d{1,3}$/.test(daysText)) {
      return json({ ok: false, error: "days_must_be_integer" }, 400);
    }
    const days = Number(daysText);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return json({ ok: false, error: "days_out_of_range" }, 400);
    }
    const siteFilter = url.searchParams.get("site");

    const { data: run, error: runError } = await supabase
      .from("water_tracker_ingestion_runs")
      .insert({ run_type: "backfill", status: "running" })
      .select("id")
      .single();
    if (runError) throw runError;
    runId = Number(run.id);

    let siteQuery = supabase
      .from("water_tracker_sites")
      .select("id, station_id, datum_offset, datum_offset_local")
      .eq("is_active", true);
    if (siteFilter) siteQuery = siteQuery.eq("id", siteFilter);
    const { data: sites, error: sitesError } = await siteQuery;
    if (sitesError) throw sitesError;
    if (!sites?.length) {
      throw new Error(siteFilter ? "site_not_found" : "no_active_sites");
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86_400_000);
    const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
    const dateTime = (date: Date) =>
      date.toISOString().slice(0, 16).replace("T", " ");
    const summary: Record<string, unknown>[] = [];
    let processedReadings = 0;
    let sourceLatestAt = 0;

    for (const site of sites) {
      if (!site.station_id) {
        summary.push({ site: site.id, skipped: "no_station" });
        continue;
      }
      const endpoint = new URL(THAIWATER_GRAPH_URL);
      endpoint.searchParams.set("station_type", "tele_waterlevel");
      endpoint.searchParams.set("station_id", String(site.station_id));
      endpoint.searchParams.set("start_date", dateOnly(startDate));
      endpoint.searchParams.set("end_date", dateTime(endDate));

      try {
        const response = await fetch(endpoint, {
          headers: { "User-Agent": "SAMCO-water-tracker/3.0" },
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`ThaiWater HTTP ${response.status}`);
        const payload = await response.json();
        const points = payload?.data?.graph_data;
        if (!Array.isArray(points)) {
          throw new Error("ThaiWater response shape changed");
        }

        const rows = points.flatMap((point: Record<string, unknown>) => {
          const wlMsl = Number(point.value);
          const measuredAt = thaiTimestamp(point.datetime);
          if (!Number.isFinite(wlMsl) || !measuredAt) return [];
          sourceLatestAt = Math.max(sourceLatestAt, new Date(measuredAt).getTime());
          return [{
            site_id: site.id,
            station_id: Number(site.station_id),
            measured_at: measuredAt,
            wl_msl: wlMsl,
            wl_design: site.datum_offset_local
              ? null
              : wlMsl + Number(site.datum_offset),
            source: "backfill_thaiwater",
          }];
        });

        let processed = 0;
        for (let index = 0; index < rows.length; index += 500) {
          const chunk = rows.slice(index, index + 500);
          const { error } = await supabase
            .from("water_tracker_readings")
            .upsert(chunk, {
              onConflict: "site_id,station_id,measured_at",
              ignoreDuplicates: true,
            });
          if (error) throw error;
          processed += chunk.length;
        }
        processedReadings += processed;
        summary.push({
          site: site.id,
          points_from_api: points.length,
          valid_points: rows.length,
          processed,
        });
      } catch (error) {
        summary.push({ site: site.id, error: errorText(error) });
      }
    }

    const failedSites = summary.filter((item) => "error" in item).length;
    const status = failedSites === 0 ? "success" : "partial";
    const { error: finishError } = await supabase
      .from("water_tracker_ingestion_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        active_sites: sites.length,
        processed_readings: processedReadings,
        skipped: summary,
        source_latest_at: sourceLatestAt
          ? new Date(sourceLatestAt).toISOString()
          : null,
        error_message: failedSites ? `${failedSites} site(s) failed` : null,
      })
      .eq("id", runId);
    if (finishError) throw finishError;

    return json({
      ok: failedSites === 0,
      run_id: runId,
      days,
      processed_readings: processedReadings,
      summary,
    }, failedSites === 0 ? 200 : 207);
  } catch (error) {
    console.error("water-tracker-backfill failed", error);
    if (runId !== null) {
      await supabase
        .from("water_tracker_ingestion_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorText(error),
        })
        .eq("id", runId);
    }
    const message = errorText(error);
    return json(
      { ok: false, error: message },
      message === "site_not_found" ? 404 : 500,
    );
  }
});
