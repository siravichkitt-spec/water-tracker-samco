'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const registry=require('./typical-sections.js'),svg=require('./section-animation.js'),ui=require('./typical-ui.js');
const now=Date.parse('2026-10-02T09:00:00Z');
const reading=(id,delta=0)=>({siteId:id,wlMsl:7.3,wlDesign:99.7,measuredAt:new Date(now-delta*60000).toISOString(),cadenceMinutes:15});
test('All component occurrences have interactive visible markers and legends in their SVG',()=>{
  for(const [id,entry]of Object.entries(registry.sites))for(const sec of entry.sections){
    const html=svg.vector({id,datumOffsetLocal:id==='buengkan-nam-hi'},sec,reading(id),now);
    assert.equal((html.match(/class="svg-marker"/g)||[]).length,sec.components.length);
    assert.equal((html.match(/class="svg-legend-item"/g)||[]).length,sec.components.length);
    for(const c of sec.components)assert.ok(html.includes('data-focus-component="'+c.id+'"'));
    assert.ok(!/\b(?:NaN|Infinity)\b/.test(html));
    assert.ok(!html.includes('<image')&&!html.includes('<img'));
  }
});
test('Live water line equals actual converted reading in the numeric domain',()=>{
  const site={id:'thachin-nakhonchaisi'},sec=registry.sites[site.id].sections[0];
  const m=svg.model(site,sec,reading(site.id),now);
  assert.equal(m.waterY,m.y(99.7));
  assert.ok(svg.vector(site,sec,reading(site.id),now).includes('data-water-value="99.7"'));
  assert.ok(svg.vector(site,sec,reading(site.id),now).includes('water-wave moving'));
});
test('Local datum keeps real station reading INSIDE image but never an overlay or freeboard',()=>{
  const site={id:'buengkan-nam-hi',datumOffsetLocal:true},sec=registry.sites[site.id].sections[0],r={...reading(site.id),wlMsl:185.4,wlDesign:185.4};
  const html=svg.vector(site,sec,r,now);
  assert.ok(html.includes('+185.400 ม.รทก.')&&html.includes('แยกสเกล'));
  assert.ok(!html.includes('class="water-layer"'));
  assert.ok(ui.difference({value:100.5},site,r).includes('เทียบไม่ได้'));
});
test('Wrong-site/null/nonfinite telemetry never appears as a water layer',()=>{
  const site={id:'prachinburi'},sec=registry.sites[site.id].sections[0];
  for(const r of [null,reading('other'),{...reading(site.id),wlMsl:NaN},{...reading(site.id),wlDesign:null}]){
    assert.ok(!svg.vector(site,sec,r,now).includes('class="water-layer"'));
  }
});
test('Stale/delayed/invalid timestamps never animate as live',()=>{
  const site={id:'prachinburi'},sec=registry.sites[site.id].sections[0];
  for(const [age,status]of [[0,'LIVE'],[45,'DELAYED'],[90,'STALE']])assert.equal(svg.state(site,reading(site.id,age),now).status,status);
  assert.equal(svg.state(site,{...reading(site.id),measuredAt:'invalid'},now).status,'UNKNOWN');
  assert.equal(svg.state(site,{...reading(site.id),cadenceMinutes:null},now).status,'UNKNOWN');
  assert.ok(!svg.vector(site,sec,reading(site.id,90),now).includes('water-wave moving'));
});
test('Full drawing section catalog includes all drainage types, detailed items, and 76 surveyed profiles without fake ground',()=>{
  const s=registry.sites['buengkan-nam-hi'].sections;
  for(const id of ['drain-1','drain-2','drain-3','stairs','cap','pile-a','pile-b','pile-c','pipe-front','manhole','railing','small-drain'])assert.ok(s.some(x=>x.id==='buengkan-'+id));
  const profiles=s.filter(x=>x.profileNumber);
  assert.equal(profiles.length,76);
  assert.equal(profiles[0].source.page,10);assert.equal(profiles.at(-1).source.page,47);
  for(const p of profiles){assert.ok(p.profileGroundStatus.includes('ยังไม่ถอด'));assert.equal(p.components[0].source.page,48);}
  assert.equal(s[0].source.sheet,'47 / 65');
});
test('No PDF images in main renderer and no random/mock telemetry generated',()=>{
  for(const file of ['section-animation.js','typical-ui.js']){
    const text=fs.readFileSync(file,'utf8');assert.ok(!text.includes('Math.random'));
    assert.ok(!text.includes('<img '));
  }
});
