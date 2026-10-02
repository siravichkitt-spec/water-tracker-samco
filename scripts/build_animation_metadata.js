// Mechanical JSON serialization of reviewed authored data. No network writes.
'use strict';
const fs=require('node:fs');
const rows=JSON.parse(fs.readFileSync('supabase-seed-sites.json','utf8'));
const literal=v=>"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb";
let sql='-- SAMCO LOGISTICS only, owner approved 2026-10-02.\n-- Metadata only: preserves all readings, datum offsets, coordinates, station IDs, thresholds, grants and policies.\nBEGIN;\n';
for(const row of rows){
  const sections=row.typical_sections.filter(s=>!s.profileNumber);
  sql+=`UPDATE public.water_tracker_sites SET typical_sections=${literal(sections)}, design_levels=${literal(row.design_levels)}, updated_at=now()`;
  if(row.id==='buengkan-nam-hi')sql+=`, datum_warning='${row.datum_warning.replace(/'/g,"''")}'`;
  sql+=` WHERE id='${row.id}';\n`;
}
const b=rows.find(r=>r.id==='buengkan-nam-hi');
const template=b.typical_sections.find(s=>s.profileNumber===1);
sql+=`UPDATE public.water_tracker_sites SET typical_sections=typical_sections || (
 SELECT jsonb_agg(
  ${literal(template)} || jsonb_build_object(
   'id','buengkan-profile-'||n,'name','รูปตัดตามแนว '||n,'profileNumber',n,
   'source',${literal(template.source)} || jsonb_build_object('page',10+(n-1)/2,'sheet',(9+(n-1)/2)||' / 65','drawingNo','D670257 / แผ่น '||(9+(n-1)/2))
  ) ORDER BY n
 ) FROM generate_series(1,76) AS n
) WHERE id='buengkan-nam-hi';\n`;
sql+=`DO $v$ BEGIN IF (SELECT sum(jsonb_array_length(typical_sections)) FROM public.water_tracker_sites WHERE is_active) <> 94 THEN RAISE EXCEPTION 'Expected 94 section/profile entries'; END IF; END $v$;\nCOMMIT;\n`;
fs.writeFileSync('outputs/section_animation_v01_20261002/update_metadata.sql',sql,'utf8');
const commands=[];
const text=v=>"'"+String(v).replace(/'/g,"''")+"'";
commands.push(`UPDATE public.water_tracker_sites SET typical_sections=${literal([b.typical_sections[0]])},design_levels=${literal(b.design_levels)},datum_warning=${text(b.datum_warning)},updated_at=now() WHERE id='buengkan-nam-hi';`);
for(const sec of b.typical_sections.filter(s=>!s.profileNumber).slice(1))commands.push(`UPDATE public.water_tracker_sites SET typical_sections=typical_sections || ${literal([sec])},updated_at=now() WHERE id='buengkan-nam-hi' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(typical_sections) s WHERE s->>'id'=${text(sec.id)});`);
commands.push(sql.slice(sql.indexOf('UPDATE public.water_tracker_sites SET typical_sections=typical_sections || (')));
// Each request is below the connector's payload limit. Metadata-only changes
// become visible incrementally; no station readings/calibration/security change.
commands[commands.length-1]=commands.at(-1).replace(/DO \$v\$[\s\S]*/, '');
console.log(process.argv.includes('--commands')?JSON.stringify(commands):sql);
