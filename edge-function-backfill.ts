// Supabase Edge Function: water-tracker-backfill
// Restricted maintenance endpoint. It accepts the scheduler secret, never a public key.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const RID_HISTORY_URL =
  "https://bigdata-api.rid.go.th/api/v1/ma/pier/rid/get_pier_by_station";

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

export function utcTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/
      .test(text)
  ) {
    return null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type BackfillRow = {
  site_id: string;
  station_id: number;
  measured_at: string;
  wl_msl: number;
  wl_design: number | null;
  source: "backfill_rid_bigdata";
};

type PreparedSite = {
  rows: BackfillRow[];
  newReadings: number;
  summary: Record<string, unknown>;
};

export async function handleBackfill(request: Request) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json({ ok: false, error: "server_configuration_error" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRole, {
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
    const writeText = url.searchParams.get("write") ?? "false";
    if (writeText !== "true" && writeText !== "false") {
      return json({ ok: false, error: "write_must_be_true_or_false" }, 400);
    }
    const write = writeText === "true";

    let siteQuery = supabase
      .from("water_tracker_sites")
      .select("id, station_id, station_code, datum_offset, datum_offset_local")
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
    const requestedStartAt = new Date(
      `${dateOnly(startDate)}T00:00:00+07:00`,
    ).getTime();
    const requestedEndExclusive = new Date(
      `${dateOnly(new Date(endDate.getTime() + 86_400_000))}T00:00:00+07:00`,
    ).getTime();
    const preparedSites: PreparedSite[] = [];

    for (const site of sites) {
      if (!site.station_id || !site.station_code) {
        preparedSites.push({
          rows: [],
          newReadings: 0,
          summary: { site: site.id, error: "missing_station_identity" },
        });
        continue;
      }
      const endpoint = new URL(RID_HISTORY_URL);
      endpoint.searchParams.set("station_code", String(site.station_code));
      endpoint.searchParams.set("from_date", dateOnly(startDate));
      endpoint.searchParams.set("to_date", dateOnly(endDate));

      try {
        const response = await fetch(endpoint, {
          headers: { "User-Agent": "SAMCO-water-tracker/3.0" },
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) {
          throw new Error(`RID Big Data HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload?.success !== true) {
          throw new Error("RID Big Data request was not successful");
        }
        const points = payload?.data;
        if (!Array.isArray(points)) {
          throw new Error("RID Big Data response shape changed");
        }

        const stationId = finiteNumber(site.station_id);
        if (stationId === null) throw new Error("invalid_station_id");
        const datumOffset = finiteNumber(site.datum_offset);
        const rowsByTimestamp = new Map<string, BackfillRow>();
        let nullValues = 0;
        let emptyValues = 0;
        let nonNumericValues = 0;
        let invalidTimestamps = 0;
        let identityMismatches = 0;
        let outOfRangePoints = 0;
        let duplicatePoints = 0;

        for (const point of points as Record<string, unknown>[]) {
          if (String(point.station_code ?? "") !== String(site.station_code)) {
            identityMismatches += 1;
            continue;
          }
          const measuredAt = utcTimestamp(point.hourly_time_utc);
          if (!measuredAt) {
            invalidTimestamps += 1;
            continue;
          }
          const measuredTime = new Date(measuredAt).getTime();
          if (
            measuredTime < requestedStartAt ||
            measuredTime >= requestedEndExclusive
          ) {
            outOfRangePoints += 1;
            continue;
          }
          if (point.wl_values === null || point.wl_values === undefined) {
            nullValues += 1;
            continue;
          }
          if (
            typeof point.wl_values === "string" &&
            point.wl_values.trim() === ""
          ) {
            emptyValues += 1;
            continue;
          }
          const wlMsl = finiteNumber(point.wl_values);
          if (wlMsl === null) {
            nonNumericValues += 1;
            continue;
          }
          const row: BackfillRow = {
            site_id: site.id,
            station_id: stationId,
            measured_at: measuredAt,
            wl_msl: wlMsl,
            wl_design: site.datum_offset_local || datumOffset === null
              ? null
              : wlMsl + datumOffset,
            source: "backfill_rid_bigdata",
          };
          const previous = rowsByTimestamp.get(measuredAt);
          if (previous) {
            duplicatePoints += 1;
            if (previous.wl_msl !== row.wl_msl) {
              throw new Error(`conflicting_duplicate_timestamp:${measuredAt}`);
            }
            continue;
          }
          rowsByTimestamp.set(measuredAt, row);
        }

        const rows = [...rowsByTimestamp.values()].sort((a, b) =>
          a.measured_at.localeCompare(b.measured_at)
        );
        const values = rows.map((row) => row.wl_msl);
        const existingByTimestamp = new Map<string, number>();
        if (rows.length > 0) {
          const pageSize = 1000;
          for (let from = 0;; from += pageSize) {
            const { data: existing, error: existingError } = await supabase
              .from("water_tracker_readings")
              .select("measured_at, wl_msl")
              .eq("site_id", site.id)
              .eq("station_id", stationId)
              .gte("measured_at", rows[0].measured_at)
              .lte("measured_at", rows[rows.length - 1].measured_at)
              .order("measured_at", { ascending: true })
              .range(from, from + pageSize - 1);
            if (existingError) throw existingError;
            for (const item of existing ?? []) {
              const measuredAt = new Date(item.measured_at).toISOString();
              const wlMsl = finiteNumber(item.wl_msl);
              if (wlMsl !== null) existingByTimestamp.set(measuredAt, wlMsl);
            }
            if (!existing || existing.length < pageSize) break;
          }
        }
        let alreadyPresent = 0;
        let existingConflicts = 0;
        for (const row of rows) {
          if (!existingByTimestamp.has(row.measured_at)) continue;
          alreadyPresent += 1;
          if (existingByTimestamp.get(row.measured_at) !== row.wl_msl) {
            existingConflicts += 1;
          }
        }
        const newReadings = rows.length - alreadyPresent;
        preparedSites.push({
          rows,
          newReadings,
          summary: {
            site: site.id,
            points_from_api: points.length,
            valid_points: rows.length,
            null_values: nullValues,
            empty_values: emptyValues,
            non_numeric_values: nonNumericValues,
            invalid_timestamps: invalidTimestamps,
            identity_mismatches: identityMismatches,
            out_of_range_points: outOfRangePoints,
            duplicate_points: duplicatePoints,
            already_present: alreadyPresent,
            new_readings: newReadings,
            existing_conflicts: existingConflicts,
            first_valid_at: rows.at(0)?.measured_at ?? null,
            last_valid_at: rows.at(-1)?.measured_at ?? null,
            minimum_wl_msl: values.length ? Math.min(...values) : null,
            maximum_wl_msl: values.length ? Math.max(...values) : null,
            ...(identityMismatches > 0
              ? { error: "source_station_identity_mismatch" }
              : outOfRangePoints > 0
              ? { error: "source_returned_out_of_range_points" }
              : existingConflicts > 0
              ? { error: "source_conflicts_with_existing_readings" }
              : rows.length === 0
              ? { error: "source_has_no_valid_water_level_values" }
              : {}),
          },
        });
      } catch (error) {
        preparedSites.push({
          rows: [],
          newReadings: 0,
          summary: { site: site.id, error: errorText(error) },
        });
      }
    }

    const summary = preparedSites.map((item) => item.summary);
    const failedSites = summary.filter((item) => "error" in item).length;
    const candidateReadings = preparedSites.reduce(
      (total, item) => total + item.rows.length,
      0,
    );
    const expectedNewReadings = preparedSites.reduce(
      (total, item) => total + item.newReadings,
      0,
    );
    const safeToWrite = failedSites === 0 && candidateReadings > 0;

    if (!write) {
      return json({
        ok: safeToWrite,
        dry_run: true,
        safe_to_write: safeToWrite,
        days,
        candidate_readings: candidateReadings,
        expected_new_readings: expectedNewReadings,
        summary,
      }, safeToWrite ? 200 : 422);
    }

    const { data: run, error: runError } = await supabase
      .from("water_tracker_ingestion_runs")
      .insert({ run_type: "backfill", status: "running" })
      .select("id")
      .single();
    if (runError) throw runError;
    runId = Number(run.id);

    if (!safeToWrite) {
      const { error: abortError } = await supabase
        .from("water_tracker_ingestion_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          active_sites: sites.length,
          processed_readings: 0,
          skipped: summary,
          source_latest_at: null,
          error_message: `${failedSites} site(s) failed source validation`,
        })
        .eq("id", runId);
      if (abortError) throw abortError;
      return json({
        ok: false,
        dry_run: false,
        safe_to_write: false,
        run_id: runId,
        days,
        candidate_readings: candidateReadings,
        expected_new_readings: expectedNewReadings,
        processed_readings: 0,
        summary,
        error: "source_validation_failed_no_readings_written",
      }, 422);
    }

    let processedReadings = 0;
    let sourceLatestAt = 0;
    for (const prepared of preparedSites) {
      for (let index = 0; index < prepared.rows.length; index += 500) {
        const chunk = prepared.rows.slice(index, index + 500);
        const { data: inserted, error } = await supabase
          .from("water_tracker_readings")
          .upsert(chunk, {
            onConflict: "site_id,station_id,measured_at",
            ignoreDuplicates: true,
          })
          .select("id");
        if (error) throw error;
        processedReadings += inserted?.length ?? 0;
        for (const row of chunk) {
          sourceLatestAt = Math.max(
            sourceLatestAt,
            new Date(row.measured_at).getTime(),
          );
        }
      }
    }

    const { error: finishError } = await supabase
      .from("water_tracker_ingestion_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        active_sites: sites.length,
        processed_readings: processedReadings,
        skipped: summary,
        source_latest_at: sourceLatestAt
          ? new Date(sourceLatestAt).toISOString()
          : null,
        error_message: null,
      })
      .eq("id", runId);
    if (finishError) throw finishError;

    return json({
      ok: true,
      dry_run: false,
      safe_to_write: true,
      run_id: runId,
      days,
      candidate_readings: candidateReadings,
      expected_new_readings: expectedNewReadings,
      processed_readings: processedReadings,
      summary,
    });
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
}

if (import.meta.main) {
  Deno.serve(handleBackfill);
}
