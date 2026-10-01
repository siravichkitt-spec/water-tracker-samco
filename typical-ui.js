(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // DB strings must never be interpreted as HTML, instructions, or external URLs.
  const safeAsset = path => /^assets\/typical\/[a-z0-9-]+\.(jpg|pdf)$/.test(path || '') ? path : '';
  function difference(level, site, reading) {
    if (site.datumOffsetLocal) return 'เทียบไม่ได้ — local datum';
    if (!reading || reading.siteId !== site.id || reading.wlDesign == null || !Number.isFinite(Number(reading.wlDesign))) return 'ไม่มีระดับน้ำสำหรับเทียบ';
    const value = Number(level.value) - Number(reading.wlDesign);
    return `น้ำ${value >= 0 ? 'ต่ำกว่า' : 'สูงกว่า'} ${Math.abs(value).toFixed(3)} ม.`;
  }
  function render(site, reading, selectedId) {
    const el = document.getElementById('typical-sections');
    const sections = site.typicalSections || [];
    if (!sections.length) {
      el.innerHTML = '<p class="error">[ต้องกรอก] ยังไม่มี typical section ของโครงการนี้</p>';
      return;
    }
    const current = sections.find(s=>s.id === selectedId) || sections[0];
    const total = sections.reduce((n,s)=>n+s.components.length,0);
    const levels = sections.reduce((n,s)=>n+root.SamcoTypical.levelsFor(s).length,0);
    const wl = reading?.siteId === site.id && reading.wlDesign != null && !site.datumOffsetLocal
      ? `น้ำจาก station แปลงสเกลแบบ +${Number(reading.wlDesign).toFixed(3)} ม. — ไม่ใช่ sensor หน้างาน`
      : site.datumOffsetLocal ? 'local datum: ปิดการเทียบ component กับ station MSL' : 'ยังไม่มีระดับน้ำสำหรับเทียบ';
    el.innerHTML = `<div class="typical-summary"><div><strong>${sections.length} section · ${total} รายการ component · ${levels} ระดับที่ระบุในแบบ</strong><br>${esc(wl)}</div>
      <label>Section ที่ใช้ใน KPI / กราฟ / สถิติ <select id="typical-select" aria-label="Section ที่ใช้เทียบกราฟ">${sections.map(s=>`<option value="${esc(s.id)}" ${s.id===current.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label></div>
      <p class="typical-limit">ตรวจครบรายการที่เห็นใน PDF ที่ได้รับ · ระดับที่ไม่ระบุ = [ต้องกรอก] ไม่คำนวณจาก pixel หรือความยาวเข็ม · รายละเอียดเหล็ก/แบบขยายที่ยังไม่แนบไม่ถือว่าตรวจแล้ว</p>
      ${sections.map(sec=>{
        const src = sec.source;
        const image = safeAsset(src.image), pdf = safeAsset(src.pdf);
        const sourceLabel = `${src.file} · PDF หน้า ${src.page} · แผ่น ${src.sheet}`;
        const rows = sec.components.map((c,index)=>`<tr data-component="${esc(c.id)}">
          <td><span class="component-index">${index+1}</span> ${esc(c.label)}<small>${esc(c.reference || 'ตาม callout ในรูปตัด')}</small>${image?`<button type="button" data-drawing="${image}" data-title="${esc(c.label+' — '+sourceLabel)}">ดูในแบบต้นฉบับ ↗</button>`:''}</td>
          <td>${esc(c.detail)}<small>ที่มา: ${esc(sourceLabel)}</small></td>
          <td>${c.levels.length ? c.levels.map(l=>`<div class="component-level" style="color:${/^#[0-9a-f]{6}$/i.test(l.color)?l.color:'#94a3c4'}">${esc(l.label)} +${Number(l.value).toFixed(3)} ม.<small>ตรวจตรง PDF · spot elevation</small></div>`).join('') : `<span class="missing-level">[ต้องกรอก]</span><small>${esc(c.missing)}</small>`}</td>
          <td>${c.levels.length ? c.levels.map(l=>`<div>${esc(difference(l,site,reading))}</div>`).join('') : '— ไม่มีระดับที่ใช้เทียบ'}</td>
        </tr>`).join('');
        return `<article class="typical-card ${sec.id===current.id?'selected':''}" data-section="${esc(sec.id)}">
          <div class="typical-card-header"><div><h4>${esc(sec.name)}</h4><p>${esc(sourceLabel)} · เลขแบบ ${esc(src.drawingNo)}<br>วันที่แบบ: ${esc(src.drawingDate || '[ต้องกรอก] ไม่ระบุ/อ่านไม่ได้ในไฟล์')} · ตรวจภาพ ${esc(src.reviewedAt)}</p></div>
          <button type="button" data-use-section="${esc(sec.id)}">${sec.id===current.id?'กำลังใช้เทียบกราฟ':'ใช้ section นี้เทียบกราฟ'}</button></div>
          <div class="typical-source"><div class="typical-preview">${image?`<button type="button" class="drawing-open" data-drawing="${image}" data-title="${esc(sourceLabel)}" aria-label="ขยายแบบ ${esc(sec.name)}"><img src="${image}" alt="${esc(sourceLabel)}" loading="lazy"><span>ขยายแบบต้นฉบับ ↗</span></button>`:'[ต้องกรอก] ภาพแบบ'}<p>${pdf?`<a href="${pdf}#page=${Number(src.page)}" target="_blank" rel="noopener">เปิด PDF ต้นฉบับ</a>`:''} · ${image?`<a href="${image}" target="_blank" rel="noopener">เปิดภาพเต็ม</a>`:''}</p></div>
          <div class="typical-notes"><strong>มิติ / วัสดุ / ช่วงงาน</strong><ul>${sec.dimensions.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
          <p>ช่วง กม.: ${esc(sec.chainage || '[ต้องกรอก] ขอ plan/รูปตัดตาม กม.')}</p>
          ${(sec.variants || []).map(v=>`<div class="section-variant"><strong>${esc(v.name)}</strong><p>${esc(v.detail)}</p><small>ที่มา: ตารางใน ${esc(sourceLabel)}</small></div>`).join('')}
          <strong>ระดับน้ำอ้างอิงจากแบบ — ไม่ใช่ค่าปัจจุบัน</strong><ul>${sec.referenceWaterLevels.map(w=>`<li>${esc(w.label)} +${Number(w.value).toFixed(3)} ม.</li>`).join('')}</ul></div></div>
          <div class="components-scroll"><table class="components-table"><thead><tr><th>ทุก component / item</th><th>Detail / spec ตามแบบ</th><th>ระดับสเกลแบบ</th><th>เทียบกับน้ำที่ station (derived)</th></tr></thead><tbody>${rows}</tbody></table></div>
          <details class="typical-audit"><summary>ที่มา / ข้อจำกัดการตรวจ</summary><p>${esc(src.revisionStatus)}</p><ul>${sec.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>
        </article>`;
      }).join('')}`;
  }
  const api = {render,difference,esc,safeAsset};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SamcoTypicalUI = api;
})(typeof window === 'undefined' ? globalThis : window);
