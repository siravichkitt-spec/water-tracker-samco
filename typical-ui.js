(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeAsset = path => /^assets\/typical\/[a-z0-9-]+\.(jpg|pdf)$/.test(path || '') ? path : '';
  const animation=typeof module!=='undefined'&&module.exports?require('./section-animation.js'):root.SamcoSectionAnimation;
  const focused=new Map();
  let waterTooltipSequence=0;
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
      ${waterStatus(site,sec,reading)}
      <div class="drawing-controls"><span>เลือกชื่อ component เพื่อ highlight และแสดงเส้นชี้${animation.state(site,reading).canOverlay&&!['pile-detail','railing-detail','manhole','small-drain','pipe-front','stairs','cap'].includes(sec.scene)?' · ชี้/แตะเส้นน้ำเพื่อดูระดับและเวลาวัด':''}</span><button type="button" data-expand-vector="${esc(sec.id)}">ขยายภาพ vector ↗</button></div>
      <div class="animation-scroll drawing-desktop">${animation.vector(site,sec,reading)}</div>
      <div class="animation-scroll drawing-mobile">${animation.vector(site,sec,reading,undefined,{compact:true})}</div>
      ${detailViews(sec)}
      <div class="drawing-levels">${sec.components.flatMap(c=>c.levels.map(l=>`<button type="button" data-focus-component="${esc(c.id)}">${esc(l.label)} <strong>+${Number(l.value).toFixed(3)} ม.</strong></button>`)).join('')}</div>
      <p class="drawing-note">geometry schematic ตาม view ในแบบ · ไม่ใช่ as-built · break line ย่อความยาวเข็ม · ระดับที่ไม่ระบุ [ต้องกรอก]${sec.scene==='stairs'?' · A–A เป็นแนวตามบันได ไม่ใช่รูปตัดตั้งฉากแม่น้ำ':''}</p>
      <div class="component-picker" aria-label="ทุก component ใน section">${sec.components.map((c,i)=>`<button type="button" data-focus-component="${esc(c.id)}"><span>${String(i+1).padStart(2,'0')}</span>${esc(c.label)}</button>`).join('')}</div>
      <div class="component-inspector" aria-live="polite">เลือกชื่อ component เพื่อดู detail ระดับ และหน้าที่มา</div>
      <details class="component-details"><summary>ทุก component / detail / ระดับ (${sec.components.length} รายการ)</summary><div class="components-scroll"><table class="components-table"><thead><tr><th>Component</th><th>Detail / spec</th><th>ระดับตามแบบ</th><th>เทียบกับน้ำ station</th></tr></thead><tbody>${rows}</tbody></table></div></details>
      <details class="typical-audit"><summary>มิติ / variant / ที่มา PDF</summary><ul>${sec.dimensions.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
      ${(sec.variants||[]).map(v=>`<p><strong>${esc(v.name)}</strong> ${esc(v.detail)}</p>`).join('')}
      <p>ช่วง กม.: ${esc(sec.chainage||'[ต้องกรอก] ตาม plan/รูปตัด')}</p>
      <p>น้ำอ้างอิงจากแบบ — ไม่ใช่ปัจจุบัน: ${sec.referenceWaterLevels.map(w=>`${esc(w.label)} +${Number(w.value).toFixed(3)} ม.`).join(' · ')}</p>
      <p>วันที่แบบ: ${esc(src.drawingDate||'[ต้องกรอก]')} · ตรวจ ${esc(src.reviewedAt)} · ${esc(src.revisionStatus)}</p>
      <ul>${sec.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>${pdf?`<a href="${pdf}#page=${Number(src.page)}" target="_blank" rel="noopener">เปิด PDF อ้างอิง ↗</a>`:''}</details>
      </details></article>`;
  }
  function detailViews(sec){
    const view=(name,body)=>`<figure>${animation.darkSvg(`<svg viewBox="0 0 360 220" role="img" aria-label="${esc(name)} · schematic ตามแบบ"><rect width="360" height="220" fill="#fbfcfe"/><g stroke="#334155" stroke-width="1.5" fill="#f1f5f9">${body}</g></svg>`)}<figcaption>${esc(name)}<small>PDF ${sec.source.page} · schematic / ไม่มีแกนระดับน้ำ</small></figcaption></figure>`;
    let views=[];
    if(sec.scene==='stairs')views=[
      view('B–B · คาน BST / เสา C1 / เสาเข็ม C','<path d="M35 45 H210 V65 H35 Z M215 45 H235 V165 H215 Z M35 150 H235 V175 H35 Z M218 175 v25 m14 -25 v25"/><path d="M216 80 H232 M216 96 H232 M216 112 H232 M216 128 H232" fill="none"/>'),
      view('หน้าตัด C1 / BST','<path d="M55 58 h75 v75 h-75 Z M210 35 h70 v120 h-70 Z"/><path d="M62 65 h61 v61 h-61 Z M217 42 h56 v106 h-56 Z" fill="none"/><g fill="#334155"><circle cx="66" cy="69" r="3"/><circle cx="119" cy="69" r="3"/><circle cx="66" cy="122" r="3"/><circle cx="119" cy="122" r="3"/></g>'),
      view('แปลนบันได / ชานพัก','<path d="M35 50 H325 V155 H35 Z M85 50 V155 M275 50 V155"/><path d="M104 50 V155 M123 50 V155 M142 50 V155 M161 50 V155 M180 50 V155 M199 50 V155 M218 50 V155 M237 50 V155 M256 50 V155" fill="none"/>'),
    ];
    if(sec.scene==='cap')views=[
      view('หน้าตัดคาน GB1 / เหล็กเสริม','<path d="M40 60 h280 v60 h-280 Z"/><path d="M48 68 h264 v44 h-264 Z" fill="none"/>'+Array.from({length:6},(_,i)=>`<circle cx="${65+i*46}" cy="75" r="3" fill="#334155"/><circle cx="${65+i*46}" cy="105" r="3" fill="#334155"/>`).join('')),
      view('GB2 · แยกจากคาน GB1','<path d="M100 40 H260 V140 H100 Z"/><path d="M111 51 H249 V129 H111 Z M170 141 V205 M190 141 V205" fill="none"/>'),
      view('แผงกรุ · แบบไม่มีช่อง / แบบมีช่อง','<path d="M50 35 h95 v145 h-95 Z M210 35 h95 v145 h-95 Z"/><circle cx="257" cy="118" r="27" fill="#fbfcfe"/><path d="M60 45 H135 V170 H60 Z M220 45 H295 V170 H220 Z M225 88 L289 146 M225 146 L289 88" fill="none"/>'),
    ];
    if(sec.scene==='manhole')views=[
      view('D–D · ช่องท่อ / พื้นบ่อ','<path d="M100 30 H260 V165 H100 Z M80 165 H280 V185 H80 Z"/><circle cx="180" cy="108" r="40" fill="#fbfcfe"/>'),
      view('F–F · แปลนบ่อพัก','<path d="M100 45 H260 V175 H100 Z M120 65 H240 V155 H120 Z"/><path d="M35 90 H100 M35 125 H100 M260 90 H325 M260 125 H325" fill="none"/>'),
      view('G–G · ฝา / กรอบ / หูยก','<path d="M55 75 H305 V125 H55 Z"/><path d="M62 82 H298 V118 H62 Z M80 95 H280 M80 108 H280" fill="none"/><circle cx="120" cy="100" r="8" fill="#fbfcfe"/><circle cx="240" cy="100" r="8" fill="#fbfcfe"/>'),
    ];
    if(sec.scene==='railing-detail')views=[
      view('A–A · ฐานราว / anchor / คาน','<path d="M174 25 h12 v110 h-12 Z M145 135 h70 v10 h-70 Z M80 145 H280 V180 H80 Z"/><path d="M155 137 V169 H164 M205 137 V169 H196" fill="none"/>'),
      view('B–B · หน้าตัดเสาราว','<path d="M120 40 h120 v120 h-120 Z M133 53 h94 v94 h-94 Z"/>'),
      view('C–C · ฐานสองเสา','<path d="M80 40 h12 v95 h-12 Z M260 40 h12 v95 h-12 Z M65 135 h42 v10 h-42 Z M245 135 h42 v10 h-42 Z M40 145 H315 V177 H40 Z"/><path d="M78 139 V167 M94 139 V167 M258 139 V167 M274 139 V167" fill="none"/>'),
    ];
    if(sec.scene==='small-drain')views=[
      view('1–1 · บ่อพักราง / ท่อ PVC','<path d="M75 40 H200 V163 H75 Z M95 60 H180 V142 H95 Z M70 31 H205 V40 H70 Z"/><path d="M200 130 H310 M200 145 H310" fill="none"/>'),
      view('2–2 · รางระบายน้ำ / ตะแกรง','<path d="M70 50 H110 V150 H250 V50 H290 V175 H70 Z"/><path d="M70 48 H290 M80 40 V55 M102 40 V55 M124 40 V55 M146 40 V55 M168 40 V55 M190 40 V55 M212 40 V55 M234 40 V55 M256 40 V55 M278 40 V55" fill="none"/>'),
    ];
    return views.length?`<div class="drawing-insets">${views.join('')}</div>`:'';
  }
  function waterStatus(site,sec,reading){
    const s=animation.state(site,reading),detail=['pile-detail','railing-detail','manhole','small-drain','pipe-front','stairs','cap'].includes(sec.scene);
    const converted=s.canOverlay&&!detail;
    const stamp=s.reading&&Number.isFinite(Date.parse(reading.measuredAt))?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}).format(new Date(reading.measuredAt)):'—';
    return `<div class="drawing-water-status"><div><small>น้ำล่าสุดจาก station · ${esc(s.status)}</small><strong>${s.reading?`${converted?Number(reading.wlDesign).toFixed(3):Number(reading.wlMsl).toFixed(3)} ${converted?'ม. สเกลแบบ':'ม.รทก.'}`:'NO DATA'}</strong></div><p>${esc(site.stationCode||reading?.stationId||'station')} · ${esc(stamp)}<br>${site.datumOffsetLocal?'แยกสเกลจากแบบ — ยังไม่ผูก BM / ไม่ overlay น้ำ':detail?'แบบขยายไม่มีแกนระดับน้ำ · reading แสดงแยก':'Derived station · ไม่ใช่ sensor หน้างาน'}</p></div>`;
  }
  function zoomCopy(svg,width='1400px'){
    const copy=svg.cloneNode(true);
    for(const el of copy.querySelectorAll('[id]'))el.id+='-zoom';
    for(const el of copy.querySelectorAll('*'))for(const attr of ['fill','clip-path'])if(el.hasAttribute(attr))el.setAttribute(attr,el.getAttribute(attr).replace(/url\(#([^)]*)\)/g,'url(#$1-zoom)'));
    copy.style.width=width;copy.style.maxWidth='none';return copy;
  }
  const waterViews=new WeakMap();
  function installWaterInteraction(host){
    if(waterViews.has(host))return;
    const view={target:null,pinned:false,point:null,tip:null};waterViews.set(host,view);
    const hide=()=>{view.target?.setAttribute('aria-expanded','false');view.target?.removeAttribute('aria-describedby');view.tip?.remove();view.tip=null;view.target=null;view.pinned=false;};
    const show=(target,event)=>{
      if(!target)return;const info=JSON.parse(target.dataset.waterInfo);
      view.target?.setAttribute('aria-expanded','false');view.target?.removeAttribute('aria-describedby');view.target=target;target.setAttribute('aria-expanded','true');
      if(event?.clientX||event?.clientY)view.point={x:event.clientX,y:event.clientY};
      const box=target.getBoundingClientRect(),point=view.point||{x:box.right-70,y:box.top+22};
      if(!view.tip){view.tip=document.createElement('div');view.tip.id='water-tooltip-'+(++waterTooltipSequence);view.tip.className='water-tooltip';view.tip.setAttribute('role','dialog');view.tip.setAttribute('aria-label','รายละเอียดระดับน้ำ station');view.tip.setAttribute('aria-live','polite');view.tip.onpointerleave=()=>{if(!view.pinned)hide();};(host.closest('dialog')||document.body).append(view.tip);}
      target.setAttribute('aria-describedby',view.tip.id);
      view.tip.innerHTML=`<button type="button" data-water-close aria-label="ปิดรายละเอียดระดับน้ำ">×</button><strong>น้ำ ${esc(info.level)}</strong><p>วัด / update ระดับ: ${esc(info.measuredAt)}</p><p>${esc(info.station)} · ${esc(info.status)}<br>MSL ${esc(info.msl)}</p><small>ระบบรับข้อมูล: ${esc(info.fetchedAt)}<br>เวลาวัดจาก station ไม่ใช่เวลาเปิดหน้า app</small>`;
      view.tip.querySelector('[data-water-close]').onclick=hide;
      view.tip.onkeydown=e=>{if(e.key==='Escape')hide();};
      const size=view.tip.getBoundingClientRect();view.tip.style.left=Math.max(12,Math.min(point.x+12,root.innerWidth-size.width-12))+'px';view.tip.style.top=Math.max(12,Math.min(point.y+18,root.innerHeight-size.height-12))+'px';
    };
    view.refresh=()=>{if(!view.target)return;const key=view.target.dataset.waterSection;const targets=Array.from(host.querySelectorAll('[data-water-section]'));const target=targets.find(t=>t.dataset.waterSection===key&&t.getBoundingClientRect().width>0);if(target)show(target);else hide();};
    host.addEventListener('pointerover',e=>{const t=e.target.closest('[data-water-info]');if(t&&!view.pinned)show(t,e);});
    host.addEventListener('pointerout',e=>{if(e.target.closest('[data-water-info]')&&!e.relatedTarget?.closest?.('[data-water-info],.water-tooltip')&&!view.pinned)hide();});
    host.addEventListener('focusin',e=>{const t=e.target.closest('[data-water-info]');if(t)show(t);});
    host.addEventListener('focusout',e=>{if(e.target.closest('[data-water-info]')&&!view.pinned)hide();});
    host.addEventListener('click',e=>{const t=e.target.closest('[data-water-info]');if(t){if(view.pinned&&view.target===t)hide();else{view.pinned=true;show(t,e);}}});
    host.addEventListener('keydown',e=>{const t=e.target.closest('[data-water-info]');if(t&&['Enter',' '].includes(e.key)){e.preventDefault();view.pinned=true;show(t);}if(e.key==='Escape')hide();});
    // A page/modal host is stable across live rerenders; install once, no per-frame listeners.
    host.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-water-info],.water-tooltip'))hide();});
  }
  function refreshZoom(){
    const dialog=document.getElementById?.('vector-dialog');if(!dialog)return;
    const site=root.currentSiteForSection?.();if(site?.id!==dialog.dataset.site){dialog.close();return;}
    const article=Array.from(document.querySelectorAll('article[data-section]')).find(a=>a.dataset.section===dialog.dataset.section);
    const svg=article?.querySelector('.full-svg');if(!svg){dialog.close();return;}
    const old=dialog.querySelector('svg'),width=old?.style.width||'1400px';old?.replaceWith(zoomCopy(svg,width));waterViews.get(dialog)?.refresh();
  }
  function expand(target){
    const article=target.closest('article');if(!article)return;
    const svg=article.querySelector('.full-svg');if(!svg)return;
    document.getElementById('vector-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='vector-dialog';dialog.className='vector-dialog';
    dialog.dataset.section=article.dataset.section;dialog.dataset.site=root.currentSiteForSection?.().id||'';
    const copy=zoomCopy(svg);
    dialog.innerHTML='<div class="vector-toolbar"><strong>ภาพ vector · zoom</strong><button type="button" data-vector-zoom="out" aria-label="ย่อภาพ">−</button><button type="button" data-vector-zoom="in" aria-label="ขยายภาพ">+</button><button type="button" data-vector-close>ปิด</button></div><div class="vector-viewport"></div>';
    dialog.querySelector('.vector-viewport').append(copy);
    dialog.addEventListener('click',event=>{
      const component=event.target.closest('[data-focus-component]');
      if(component){const a=Array.from(document.querySelectorAll('article[data-section]')).find(a=>a.dataset.section===dialog.dataset.section);const t=Array.from(a?.querySelectorAll('[data-focus-component]')||[]).find(t=>t.dataset.focusComponent===component.dataset.focusComponent);if(t){focus(t);refreshZoom();}return;}
      const t=event.target.closest('button');if(!t)return;
      if(t.hasAttribute('data-vector-close'))dialog.close();else if(t.dataset.vectorZoom){const image=dialog.querySelector('svg');image.style.width=Math.max(700,Math.min(4200,parseInt(image.style.width)*(t.dataset.vectorZoom==='in'?1.25:.8)))+'px';}
    });
    dialog.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('[data-focus-component]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
    dialog.addEventListener('close',()=>{dialog.querySelector('.water-tooltip')?.remove();dialog.remove();Array.from(document.querySelectorAll('[data-expand-vector]')).find(t=>t.dataset.expandVector===dialog.dataset.section)?.focus();},{once:true});
    document.body.append(dialog);installWaterInteraction(dialog);dialog.showModal();
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
      <p class="typical-limit">ภาพเส้น vector ตาม view ในแบบ · เลือกชื่อเพื่อชี้ component · เฉพาะระดับที่มี source ใช้เทียบน้ำจริง · ไม่มีระดับ = [ต้องกรอก]${site.datumOffsetLocal?' · บึงกาฬยังไม่ผูก BM: น้ำ MSL แสดงแยกสเกล':''}</p>
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
      installWaterInteraction(el);waterViews.get(el)?.refresh();
      animation.animate(el,previous);
      refreshZoom();
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
  const api={render,difference,esc,safeAsset,focus,expand};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SamcoTypicalUI=api;
})(typeof window==='undefined'?globalThis:window);
