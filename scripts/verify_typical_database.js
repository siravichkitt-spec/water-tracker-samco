'use strict';
// Read-only public REST verification against SAMCO LOGISTICS; no secret key needed.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const html=fs.readFileSync('index.html','utf8');
const url=html.match(/const SB_URL = '([^']+)'/)[1];
const key=html.match(/const SB_ANON = '([^']+)'/)[1];
assert.equal(url,'https://yiyoagypmcnatdauuadf.supabase.co');
const expected=JSON.parse(fs.readFileSync('supabase-seed-sites.json','utf8'));
(async()=>{
  const response=await fetch(url+'/rest/v1/water_tracker_sites?select=id,project_ref,typical_sections,design_levels,datum_offset,datum_offset_local,station_id,lat,lng,alert_crit_design_level&is_active=eq.true',{headers:{apikey:key}});
  assert.ok(response.ok,'Public SELECT failed: '+response.status);
  const rows=await response.json();
  assert.equal(rows.length,5);
  let components=0,sections=0,levels=0;
  for(const row of rows){
    const e=expected.find(e=>e.id===row.id);
    assert.ok(e);
    assert.ok(isDeepStrictEqual(row.typical_sections,e.typical_sections),row.id+': section metadata mismatch (inspect source registry and database; omit huge diff)');
    assert.deepEqual(row.design_levels,e.design_levels);
    assert.equal(row.project_ref,e.project_ref);
    assert.equal(Number(row.datum_offset),Number(e.datum_offset));
    assert.equal(row.datum_offset_local,e.datum_offset_local);
    assert.equal(Number(row.station_id),Number(e.station_id));
    assert.equal(Number(row.lat),Number(e.lat));
    assert.equal(Number(row.lng),Number(e.lng));
    assert.equal(Number(row.alert_crit_design_level),Number(e.alert_crit_design_level));
    for(const s of row.typical_sections){sections++;components+=s.components.length;levels+=s.components.reduce((n,c)=>n+c.levels.length,0);}
    console.log(row.id+': all fields match source registry; public SELECT successful');
  }
  assert.equal(sections,94);assert.equal(components,1265);assert.equal(levels,184);
  console.log('Verified 5 sites / 94 section/profile entries / 1265 component occurrences / 184 spot-level occurrences (including repeated typical references).');
})().catch(error=>{console.error(error);process.exitCode=1;});
