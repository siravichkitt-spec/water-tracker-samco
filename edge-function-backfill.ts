import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const TW = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph";

serve(async (req) => {
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days") || "30";
  const days = parseInt(daysParam);

  const { data: sites } = await supa
    .from("water_tracker_sites")
    .select("id, station_id, datum_offset, datum_offset_local")
    .eq("is_active", true);

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0,10);
  const fmtDT = (d: Date) => d.toISOString().slice(0,16).replace('T',' ');

  const summary: any[] = [];
  for (const site of sites || []) {
    const u = `${TW}?station_type=tele_waterlevel&station_id=${site.station_id}&start_date=${fmt(startDate)}&end_date=${encodeURIComponent(fmtDT(endDate))}`;
    try {
      const r = await fetch(u);
      const j = await r.json();
      const pts = j?.data?.graph_data || [];
      const rows = pts
        .filter((p: any) => p.value !== null && p.value !== undefined)
        .map((p: any) => {
          const wl_msl = Number(p.value);
          const wl_design = site.datum_offset_local ? null : wl_msl + Number(site.datum_offset);
          return {
            site_id: site.id,
            station_id: site.station_id,
            measured_at: new Date(p.datetime.replace(' ', 'T') + ':00+07:00').toISOString(),
            wl_msl,
            wl_design,
            source: 'backfill_thaiwater',
          };
        });
      // insert in chunks of 500
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i+500);
        const { error } = await supa.from('water_tracker_readings').upsert(chunk, {
          onConflict: 'site_id,station_id,measured_at', ignoreDuplicates: true
        });
        if (error) { summary.push({site: site.id, error: error.message}); break; }
        inserted += chunk.length;
      }
      summary.push({site: site.id, points: pts.length, inserted});
    } catch (e) {
      summary.push({site: site.id, error: String(e)});
    }
  }
  return new Response(JSON.stringify({ ok: true, days, summary }, null, 2),
    { headers: { "content-type": "application/json" } });
});
