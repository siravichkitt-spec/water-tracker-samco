'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const registry = require('./typical-sections.js');
const ui = require('./typical-ui.js');
// Independent spot-level transcription from the six supplied PDF pages.
const expected = {
  'thachin-1':[100,98,97,96,95], 'thachin-2':[99.2,97.2],
  'nan-typical':[100.5,98,92.5,91.5], 'angthong-typical':[99,97,92.6],
  'prachin-typical':[100,97.5], 'buengkan-typical':[100.5,98.5],
};
test('All six PDF sections have the independently checked spot levels',()=>{
  const sections = Object.values(registry.sites).flatMap(e=>e.sections);
  assert.equal(sections.length,6);
  for (const sec of sections) assert.deepEqual(registry.levelsFor(sec).map(l=>l.value),expected[sec.id]);
});
test('Every component has provenance, detail, and either explicit levels or an honest missing-level reason',()=>{
  let components=0,levels=0;
  for (const entry of Object.values(registry.sites)) for (const sec of entry.sections) {
    const ids = new Set();
    assert.ok(sec.source.file && sec.source.page && sec.source.sheet);
    assert.ok(fs.existsSync(sec.source.image));
    assert.ok(fs.existsSync(sec.source.pdf));
    for (const c of sec.components) {
      assert.ok(!ids.has(c.id)); ids.add(c.id);
      assert.ok(c.label && c.detail);
      if (!c.levels.length) assert.ok(c.missing);
      for (const l of c.levels) { assert.equal(typeof l.value,'number'); assert.ok(Number.isFinite(l.value)); levels++; }
      components++;
    }
  }
  assert.equal(components,93); assert.equal(levels,18);
});
test('Original PDFs are byte-identical to the provenance manifest',()=>{
  const manifest=JSON.parse(fs.readFileSync('assets/typical/source_manifest.json','utf8'));
  assert.equal(manifest.reduce((n,s)=>n+s.pages,0),6);
  for (const src of manifest) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(`assets/typical/${src.asset}.pdf`)).digest('hex'),src.sha256);
});
test('Nan explicitly retains both pile-length variants and its plan dimensions',()=>{
  const sec=registry.sites['khoksalut-nan'].sections[0];
  assert.deepEqual(sec.variants.map(v=>v.chainage),['0+000–0+080','0+081–0+700']);
  assert.ok(sec.variants[0].detail.includes('8.00'));
  assert.ok(sec.variants[1].detail.includes('9.00'));
  assert.ok(sec.dimensions.some(d=>d.includes('1.20') && d.includes('1.00')));
});
test('Unknown levels are never fabricated from pile length, and spacing is not cut-off',()=>{
  for (const id of ['prachinburi','buengkan-nam-hi']) {
    const sec=registry.sites[id].sections[0];
    for (const type of ['pile-a','pile-b']) assert.equal(sec.components.find(c=>c.id===type).levels.length,0);
  }
  assert.equal(registry.sites['thachin-nakhonchaisi'].sections[1].components.find(c=>c.id==='pile-d').levels.length,0);
});
test('Local datum, null/no data, non-finite readings and wrong-site readings never get a numeric distance',()=>{
  const level={value:100}; const s={id:'test'};
  assert.equal(ui.difference(level,s,{siteId:'test',wlDesign:98.75}),'น้ำต่ำกว่า 1.250 ม.');
  assert.equal(ui.difference(level,s,{siteId:'test',wlDesign:101}),'น้ำสูงกว่า 1.000 ม.');
  assert.ok(ui.difference(level,{...s,datumOffsetLocal:true},{siteId:'test',wlDesign:185}).includes('เทียบไม่ได้'));
  for (const reading of [null,{siteId:'other',wlDesign:98},{siteId:'test',wlDesign:null},{siteId:'test',wlDesign:NaN}]) assert.ok(ui.difference(level,s,reading).includes('ไม่มีระดับน้ำ'));
});
test('Hydration always uses drawing levels, supports DB sections, and keeps fallback source available',()=>{
  const site=registry.hydrate({id:'angthong-bangkaew',designLevels:[{value:96.5}]});
  assert.deepEqual(site.designLevels.map(l=>l.value),[99,97,92.6]);
  assert.equal(registry.hydrate(site,site.typicalSections).typicalSections.length,1);
});
test('Renderer shows all sections/items without depending on telemetry',()=>{
  let html=''; global.document={getElementById:()=>({set innerHTML(value){html=value;}})};
  global.SamcoTypical=registry;
  const s=registry.hydrate({id:'thachin-nakhonchaisi'});
  ui.render(s,null,'thachin-2');
  assert.equal((html.match(/data-component=/g)||[]).length,26);
  assert.equal((html.match(/<article/g)||[]).length,2);
  assert.ok(html.includes('+99.200') && html.includes('+100.000'));
  assert.ok(html.includes('[ต้องกรอก]'));
  delete global.document; delete global.SamcoTypical;
});
test('Source paths are limited to bundled assets; DB text is escaped',()=>{
  assert.equal(ui.safeAsset('https://evil.invalid/file.jpg'),'');
  assert.equal(ui.safeAsset('assets/typical/../../secret.pdf'),'');
  assert.equal(ui.safeAsset('assets/typical/nan-page-1.jpg'),'assets/typical/nan-page-1.jpg');
  assert.equal(ui.esc('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;');
});
test('Frontend has valid JavaScript, no fake section geometry, and all consumers use selected-section levels',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(inline);
  assert.ok(!html.includes('yScale(100)'));
  assert.ok(!html.includes('section-svg'));
  assert.equal((html.match(/designLevelsFor\(s\)\.find/g)||[]).length,3);
  assert.match(html,/renderSiteInfo\(\);\s+renderCrossSection\(\);/);
});
test('Seed, JSON registry, configs and critical thresholds are synchronized',()=>{
  const seed=JSON.parse(fs.readFileSync('supabase-seed-sites.json','utf8'));
  const saved=JSON.parse(fs.readFileSync('sites/typical-sections.json','utf8'));
  for (const row of seed) {
    assert.deepEqual(row.typical_sections,saved.sites[row.id].sections);
    assert.deepEqual(row.design_levels,registry.levelsFor(row.typical_sections[0]));
  }
  assert.equal(Number(seed.find(s=>s.id==='angthong-bangkaew').alert_crit_design_level),99);
  assert.equal(Number(seed.find(s=>s.id==='thachin-nakhonchaisi').alert_crit_design_level),99.2);
  assert.equal(Number(seed.find(s=>s.id==='buengkan-nam-hi').alert_crit_design_level),187);
});
