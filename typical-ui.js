(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeAsset = path => /^assets\/typical\/[a-z0-9-]+\.(jpg|pdf)$/.test(path || '') ? path : '';
  const animation=typeof module!=='undefined'&&module.exports?require('./section-animation.js'):root.SamcoSectionAnimation;
  const focused=new Map();
  function difference(level, site, reading) {
    if (site.datumOffsetLocal) return 'เทียบไม่ได้ — local datum';
    if (!reading || reading.siteId !== site.id || reading.wlDesign == null || !Number.isFinite(Number(reading.wlDesign))) return 'ไม่มีระดับน้ำสำหรับเทียบ';
    const value = Number(level.value) - Number(reading.wlDesign);
    return `น้ำ${value >= 0 ? 'ต่ำกว่า' : 'สูงกว่า'} ${Math.abs(value).toFixed(3)} ม.`;
  }
  function sourceLabel(src){return `${src.file} · PDF หน้า ${src.page} · แผ่น ${src.sheet}`;}
  function card(sec,site,reading,current){
    const src=sec.source,pdf=safeAsset(src.pdf);
    const rows=sec.components.map((c,index)=>{
      const cs=c.source||src;
      return `<tr data-component="${esc(c.id)}" tabindex="0"><td><button class="component-select" type="button" data-focus-component="${esc(c.id)}">${index+1}. ${esc(c.label)}</button><small>${esc(c.reference||'ตาม callout ในรูปตัด')}</small></td>
        <td>${esc(c.detail)}<small>ที่มา: ${esc(sourceLabel(cs))}</small></td>
        <td>${c.levels.length?c.levels.map(l=>`<div class="component-level">${esc(l.label)} ${Number(l.value)>=0?'+':''}${Number(l.value).toFixed(3)} ม.<small>spot elevation ตามแบบ</small></div>`).join(''):`<span class="missing-level">[ต้องกรอก]</span><small>${esc(c.missing)}</small>`}</td>
        <td>${c.levels.length?c.levels.map(l=>`<div>${esc(difference(l,site,reading))}</div>`).join(''):'— ไม่มีระดับที่ใช้เทียบ'}</td></tr>`;
    }).join('');
    return `<article class="typical-card ${sec.id===current.id?'selected':''}" data-section="${esc(sec.id)}">
      <details class="section-panel" ${sec.id===current.id||(!sec.profileNumber&&site.typicalSections.length<4)?'open':''}>
      <summary class="section-summary">${esc(sec.name)} <span>${sec.components.length} component · แผ่น ${esc(src.sheet)}</span></summary>
      <div class="typical-card-header"><p>${esc(sourceLabel(src))} · เลขแบบ ${esc(src.drawingNo)}</p><button type="button" data-use-section="${esc(sec.id)}">${sec.id===current.id?'กำลังใช้เทียบกราฟ':'ใช้ section นี้เทียบกราฟ'}</button></div>
      ${sec.profileGroundStatus?`<p class="typical-limit profile-limit">${esc(sec.profileGroundStatus)}</p>`:''}
      <div class="animation-scroll">${animation.vector(site,sec,reading)}</div>
      <p class="animation-mobile-hint">เลื่อนภาพแนวนอนเพื่อดูค่าน้ำและรายการด้านขวา → · กดหมายเลขดู detail ด้านล่าง</p>
      <div class="component-inspector" aria-live="polite">กดหมายเลขหรือชื่อ component ในภาพเพื่อดู detail และระดับ</div>
      <details class="component-details"><summary>ทุก component / detail / ระดับ (${sec.components.length} รายการ)</summary><div class="components-scroll"><table class="components-table"><thead><tr><th>Component</th><th>Detail / spec</th><th>ระดับตามแบบ</th><th>เทียบกับน้ำ station</th></tr></thead><tbody>${rows}</tbody></table></div></details>
      <details class="typical-audit"><summary>มิติ / variant / ที่มา PDF</summary><ul>${sec.dimensions.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
      ${(sec.variants||[]).map(v=>`<p><strong>${esc(v.name)}</strong> ${esc(v.detail)}</p>`).join('')}
      <p>ช่วง กม.: ${esc(sec.chainage||'[ต้องกรอก] ตาม plan/รูปตัด')}</p>
      <p>น้ำอ้างอิงจากแบบ — ไม่ใช่ปัจจุบัน: ${sec.referenceWaterLevels.map(w=>`${esc(w.label)} +${Number(w.value).toFixed(3)} ม.`).join(' · ')}</p>
      <p>วันที่แบบ: ${esc(src.drawingDate||'[ต้องกรอก]')} · ตรวจ ${esc(src.reviewedAt)} · ${esc(src.revisionStatus)}</p>
      <ul>${sec.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>${pdf?`<a href="${pdf}#page=${Number(src.page)}" target="_blank" rel="noopener">เปิด PDF อ้างอิง ↗</a>`:''}</details>
      </details></article>`;
  }
  function render(site,reading,selectedId){
    const el=document.getElementById('typical-sections'),sections=site.typicalSections||[];
    if(!sections.length){el.innerHTML='<p class="error">[ต้องกรอก] ยังไม่มี typical section ของโครงการนี้</p>';return;}
    const previous=new Map();
    if(el.querySelectorAll)for(const svg of el.querySelectorAll('[data-section-svg]')){
      const layer=svg.querySelector('.water-layer');if(layer)previous.set(svg.dataset.sectionSvg,{value:Number(layer.dataset.waterValue),y:Number(layer.dataset.waterY)});
    }
    const current=sections.find(s=>s.id===selectedId)||sections[0];
    const openIds=el.querySelectorAll?Array.from(el.querySelectorAll('article:has(.section-panel[open])')).map(n=>n.dataset.section):[];
    const expanded=el.querySelectorAll?Array.from(el.querySelectorAll('article')).flatMap(a=>Array.from(a.querySelectorAll('details[open]')).map(d=>[a.dataset.section,d.className])):[];
    const catalogOpen=!!el.querySelector?.('.profile-catalog[open]');
    const total=sections.reduce((n,s)=>n+s.components.length,0);
    el.innerHTML=`<div class="typical-summary"><div><strong>ภาพ animation · ทุก component</strong><br>${sections.length} section / รูปตัด · ${total} รายการ (รวม component ที่ซ้ำระหว่าง section)</div>
      <label>เลือก section <select id="typical-select" aria-label="Section ที่ใช้เทียบกราฟ">${sections.map(s=>`<option value="${esc(s.id)}" ${s.id===current.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label></div>
      <p class="typical-limit">เส้นน้ำใช้ reading จริงพร้อมเวลา · รูปร่าง component เป็น schematic; เฉพาะระดับที่ระบุในแบบใช้แกนระดับจริง · ไม่มีระดับ = [ต้องกรอก]${site.datumOffsetLocal?' · บึงกาฬยังไม่ผูก BM: น้ำ MSL แสดงแยกสเกล':''}</p>
      ${card(current,site,reading,current)}
      <div class="other-sections"><h4>Section อื่น — กดเพื่อแสดงทั้งหมด</h4>${sections.filter(s=>s.id!==current.id&&!s.profileNumber).map(s=>card(s,site,reading,current)).join('')}</div>
      ${sections.some(s=>s.profileNumber)?`<details class="profile-catalog"><summary>รูปตัดตามแนวทั้งหมด (${sections.filter(s=>s.profileNumber).length}) — ดินสำรวจยังไม่ digitize</summary><div class="profile-buttons">${sections.filter(s=>s.profileNumber).map(s=>`<button type="button" data-use-section="${esc(s.id)}">${esc(s.name)} · แผ่น ${esc(s.source.sheet)}</button>`).join('')}</div></details>`:''}`;
    if(el.querySelectorAll){
      for(const panel of el.querySelectorAll('.section-panel'))if(openIds.includes(panel.closest('article').dataset.section))panel.open=true;
      for(const article of el.querySelectorAll('article')){
        for(const detail of article.querySelectorAll('details'))if(expanded.some(([id,cls])=>id===article.dataset.section&&cls===detail.className))detail.open=true;
        const cid=focused.get(site.id+':'+article.dataset.section);
        if(cid){const target=Array.from(article.querySelectorAll('[data-focus-component]')).find(t=>t.dataset.focusComponent===cid);if(target)focus(target);}
      }
      if(catalogOpen&&el.querySelector('.profile-catalog'))el.querySelector('.profile-catalog').open=true;
      animation.animate(el,previous);
    }
  }
  function focus(target){
    const article=target.closest('article'),id=target.dataset.focusComponent;if(!article||!id)return;
    for(const el of article.querySelectorAll('[data-focus-component],tr[data-component]'))el.classList.toggle('component-active',el.dataset.focusComponent===id||el.dataset.component===id);
    const secId=article.dataset.section,site=root.currentSiteForSection?.();
    const sec=site?.typicalSections.find(s=>s.id===secId),c=sec?.components.find(c=>c.id===id);
    if(!c)return;
    focused.set(site.id+':'+secId,id);
    const info=article.querySelector('.component-inspector');
    info.innerHTML=`<strong>${esc(c.label)}</strong><p>${esc(c.detail)}</p><p>${c.levels.length?c.levels.map(l=>`${esc(l.label)} +${Number(l.value).toFixed(3)} ม.`).join(' · '):'ระดับ [ต้องกรอก] — ภาพ component เป็น schematic ไม่ใช้คำนวณ freeboard'}</p><small>${esc(sourceLabel(c.source||sec.source))}</small>`;
  }
  const api={render,difference,esc,safeAsset,focus};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SamcoTypicalUI=api;
})(typeof window==='undefined'?globalThis:window);
