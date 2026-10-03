'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const registry=require('./typical-sections.js'),svg=require('./section-animation.js'),ui=require('./typical-ui.js');
const now=Date.parse('2026-10-02T09:00:00Z');
const reading=(id,delta=0)=>({siteId:id,wlMsl:7.3,wlDesign:99.7,measuredAt:new Date(now-delta*60000).toISOString(),cadenceMinutes:15});

test('Superseded site requests cannot log mutable telemetry or paint another project error',async()=>{
  const vm=require('node:vm'),html=fs.readFileSync('index.html','utf8');
  const source=html.slice(html.indexOf('async function loadSite({'),html.indexOf('\nfunction subscribeRealtime()'));
  for(const fail of [false,true]){
    let resolveChart,rejectReading;const errors=[],logs=[];
    const chart=new Promise(resolve=>{resolveChart=resolve;});
    const c={loadSequence:0,currentSite:{id:'old',stationId:'station'},currentReading:null,
      rangeCache:{},allStations:[],latestIngestion:null,currentDays:3,
      fetchLatestReadingFromDB:()=>fail?new Promise((resolve,reject)=>{rejectReading=reject;}):Promise.resolve(reading('old')),
      fetchLatestIngestion:()=>Promise.resolve(null),renderRecentChart:()=>chart,renderHistoricalChart:()=>chart,
      document:{getElementById:()=>{throw Error('Superseded request touched UI');}},
      console:{log:(...args)=>logs.push(args),error:e=>errors.push(e),warn:()=>{}}};
    for(const fn of ['renderWarningBanner','renderSiteInfo','renderCrossSection','renderKPIs','renderConnectionStatus'])c[fn]=()=>{};
    vm.runInNewContext(source+'\nglobalThis.run=loadSite;',c);
    const pending=c.run();await Promise.resolve();await Promise.resolve();
    c.currentSite={id:'new'};c.currentReading=null;c.loadSequence++;
    if(fail)rejectReading(Error('Old request failed'));else resolveChart();
    await pending;assert.equal(errors.length,0);assert.equal(logs.length,0);
  }
});
test('Every component has source geometry and an external callout without number circles',()=>{
  for(const [id,entry]of Object.entries(registry.sites))for(const sec of entry.sections){
    const html=svg.vector({id,datumOffsetLocal:id==='buengkan-nam-hi'},sec,reading(id),now);
    assert.equal((html.match(/class="svg-callout"/g)||[]).length,sec.components.length);
    assert.ok(!html.includes('svg-marker')&&!html.includes('svg-legend-item'));
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
  const html=svg.vector(site,sec,reading(site.id),now);
  assert.ok(html.indexOf('class="water-layer"')<html.indexOf('class="structure-layer"'));
});
test('Drain 3 S0 elevation anchor is on the river side, not the inlet headwall',()=>{
  const site={id:'buengkan-nam-hi',datumOffsetLocal:true},sec=registry.sites[site.id].sections.find(s=>s.scene==='drain-3');
  const m=svg.model(site,sec,reading(site.id),now),g=svg.geometry(site,sec,m,'test');
  assert.ok(g.anchors['pipe-mouth-level'][0]>g.ax);
  assert.equal(g.anchors['pipe-mouth-level'][1],m.y(98.65));
  assert.equal(g.anchors['catchment-floor'][1],m.y(98.1)+6.5);
});
test('Callout bounding boxes never overlap one another or the drawing region',()=>{
  for(const [id,entry]of Object.entries(registry.sites))for(const sec of entry.sections){
    const site={id,datumOffsetLocal:id==='buengkan-nam-hi'},m=svg.model(site,sec,reading(id),now),g=svg.geometry(site,sec,m,'test');
    const labels=svg.calloutLayout(sec,g.anchors);
    for(const a of labels){
      assert.ok(a.x+a.width<315||a.x>1115);
      for(const b of labels)if(a!==b)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
    }
    assert.equal(Object.keys(g.anchors).length,sec.components.length);
  }
});
test('Project profiles are distinct and Thachin section 2 reverses A/B locations',()=>{
  assert.equal(new Set(Object.values(svg.profiles).map(p=>JSON.stringify(p))).size,5);
  const site={id:'thachin-nakhonchaisi'},secs=registry.sites[site.id].sections;
  const a=svg.geometry(site,secs[0],svg.model(site,secs[0],null,now),'a');
  const b=svg.geometry(site,secs[1],svg.model(site,secs[1],null,now),'b');
  assert.ok(a.anchors['pile-a'][0]>a.anchors['pile-b'][0]);
  assert.ok(b.anchors['pile-a'][0]<b.anchors['pile-b'][0]);
});
test('All views render high/low/stale/no-data values and compact overview without placeholders',()=>{
  for(const [id,entry]of Object.entries(registry.sites))for(const sec of entry.sections)for(const value of [70,99.7,120]){
    const r={...reading(id,90),wlDesign:value},html=svg.vector({id,datumOffsetLocal:id==='buengkan-nam-hi'},sec,r,now,{compact:true});
    assert.ok(!/\b(?:NaN|Infinity|undefined)\b/.test(html));
    assert.ok(!html.includes('svg-callout'));
  }
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
