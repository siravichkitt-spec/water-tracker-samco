// Mechanical synchronization from the authored registry; no database/network writes.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../typical-sections.js');
const repo = path.resolve(__dirname,'..');
const manifest = JSON.parse(fs.readFileSync(path.join(repo,'assets/typical/source_manifest.json'),'utf8'));
const auditDir = path.join(repo,'outputs/typical_sections_water_tracker_v01_20261001');
fs.mkdirSync(auditDir,{recursive:true});
const json = value => JSON.stringify(value,null,2)+'\n';
const write = (file,value) => fs.writeFileSync(path.join(repo,file),json(value),'utf8');
for (const entry of Object.values(registry.sites)) {
  for (const sec of entry.sections) {
    const original = manifest.find(s=>s.originalFile === sec.source.file);
    if (!original) throw new Error('Source not found: '+sec.source.file);
    sec.source.sha256 = original.sha256;
  }
}
write('sites/typical-sections.json',{revision:registry.revision,sites:registry.sites});
const files = {'khoksalut-nan':'khoksalut.json','angthong-bangkaew':'angthong.json','prachinburi':'prachinburi.json','buengkan-nam-hi':'buengkan.json'};
for (const [id,file] of Object.entries(files)) {
  const site = JSON.parse(fs.readFileSync(path.join(repo,'sites',file),'utf8'));
  const entry = registry.sites[id];
  site.typicalSections = entry.sections;
  site.designLevels = registry.levelsFor(entry.sections[0]);
  if (entry.projectRef) site.projectRef = entry.projectRef;
  if (id === 'prachinburi') {
    site.location = 'หมู่ 4 ต.หาดนางแก้ว อ.กบินทร์บุรี จ.ปราจีนบุรี (ตาม title block; เจ้าของงานยืนยัน site เดิม)';
    site.projectCode = '68-PR03-SD-01 (เลขแบบ)';
    site.pileInfo = {typeA:'0.30×0.50×11.00 ม. @1.00 ม. (ระยะห่าง ไม่ใช่ cut-off)',typeB:'0.30×0.40×11.00 ม. @1.00 ม.'};
  }
  write('sites/'+file,site);
}
const seed = JSON.parse(fs.readFileSync(path.join(repo,'supabase-seed-sites.json'),'utf8'));
for (const row of seed) {
  const entry = registry.sites[row.id];
  if (!entry) continue;
  row.typical_sections = entry.sections;
  row.design_levels = registry.levelsFor(entry.sections[0]);
  if (entry.projectRef) row.project_ref = entry.projectRef;
  // Critical level is the lowest explicit crest across all supplied sections.
  // Keep operational warning values and local-datum station thresholds unchanged.
  if (!row.datum_offset_local) row.alert_crit_design_level = Math.min(...entry.sections.flatMap(registry.levelsFor).filter(l=>l.kind==='crest').map(l=>l.value));
}
write('supabase-seed-sites.json',seed);
const literal = value => "'"+JSON.stringify(value).replace(/'/g,"''")+"'::jsonb";
const text = value => "'"+String(value).replace(/'/g,"''")+"'";
const migrationFile = process.argv[2];
if (migrationFile) {
  let sql = `-- SAMCO LOGISTICS only; owner approved 2026-10-01.\n-- Sources and hashes in assets/typical/source_manifest.json.\n-- No readings, station IDs, coordinates, datum offsets, roles or policies changed.\nALTER TABLE public.water_tracker_sites\n  ADD COLUMN IF NOT EXISTS typical_sections jsonb NOT NULL DEFAULT '[]'::jsonb;\nALTER TABLE public.water_tracker_sites\n  ADD CONSTRAINT water_tracker_typical_sections_array CHECK (jsonb_typeof(typical_sections) = 'array');\nCOMMENT ON COLUMN public.water_tracker_sites.typical_sections IS 'Source-linked typical sections and component inventory; null/absent elevation must never be inferred.';\n`;
  for (const row of seed) {
    if (!registry.sites[row.id]) continue;
    sql += `\nUPDATE public.water_tracker_sites SET\n typical_sections = ${literal(row.typical_sections)},\n design_levels = ${literal(row.design_levels)},\n project_ref = ${text(row.project_ref)},\n alert_crit_design_level = ${row.alert_crit_design_level == null ? 'NULL' : Number(row.alert_crit_design_level)},\n updated_at = now()\nWHERE id = ${text(row.id)};\n`;
  }
  sql += `\nDO $verify$ BEGIN\n IF (SELECT count(*) FROM public.water_tracker_sites WHERE id IN (${Object.keys(registry.sites).map(text).join(',')} ) AND jsonb_array_length(typical_sections)>0) <> 5 THEN\n  RAISE EXCEPTION 'Typical sections: expected all five SAMCO sites';\n END IF;\nEND $verify$;\n`;
  fs.writeFileSync(path.resolve(repo,migrationFile),sql,'utf8');
  console.log('Migration synchronized: '+migrationFile);
}
const before = JSON.parse(fs.readFileSync(path.join(auditDir,'sites_before.json'),'utf8'));
let rollback = '-- Restores only the design metadata changed by this release. Preserves all telemetry and schema.\nBEGIN;\n';
for (const row of before) rollback += `UPDATE public.water_tracker_sites SET typical_sections = '[]'::jsonb, design_levels = ${literal(row.design_levels)}, project_ref = ${text(row.project_ref)}, alert_crit_design_level = ${row.alert_crit_design_level == null ? 'NULL' : Number(row.alert_crit_design_level)}, updated_at = now() WHERE id = ${text(row.id)};\n`;
rollback += 'COMMIT;\n';
fs.writeFileSync(path.join(auditDir,'rollback_design_metadata.sql'),rollback,'utf8');
for (const [id,entry] of Object.entries(registry.sites)) console.log(`${id}: ${entry.sections.length} sections, ${entry.sections.reduce((n,s)=>n+s.components.length,0)} components, ${entry.sections.flatMap(registry.levelsFor).length} explicit levels`);
