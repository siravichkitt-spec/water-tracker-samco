/* Vector section renderer. Only verified spot elevations and actual telemetry
 * use the numerical axis. The remaining geometry is explicitly schematic.
 */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>v!=null && v!=='' && Number.isFinite(Number(v));
  const signed=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(3)}`;
  function state(site,reading,now=Date.now()){
    if(!reading || reading.siteId!==site.id || !finite(reading.wlMsl))return {status:'NO DATA',color:'#94a3b8',reading:null,canOverlay:false};
    const time=Date.parse(reading.measuredAt),cadence=Number(reading.cadenceMinutes);
    const age=(now-time)/60000;
    let status=!Number.isFinite(time)||age<0||!finite(cadence)||cadence<=0?'UNKNOWN':age<=cadence*2?'LIVE':age<=cadence*4?'DELAYED':'STALE';
    return {status,color:status==='LIVE'?'#38bdf8':status==='STALE'?'#ef4444':'#fbbf24',reading,canOverlay:!site.datumOffsetLocal&&finite(reading.wlDesign)&&Number.isFinite(time)};
  }
  function model(site,sec,reading,now){
    const s=state(site,reading,now),levels=sec.components.flatMap(c=>c.levels);
    const vals=[...levels.map(l=>l.value),...(sec.referenceWaterLevels||[]).map(l=>l.value)];
    if(s.canOverlay)vals.push(Number(reading.wlDesign));
    const min=vals.length?Math.min(...vals)-1:0,max=vals.length?Math.max(...vals)+1:1;
    const y=v=>86+(max-Number(v))/(max-min)*250;
    return {s,levels,min,max,y,waterY:s.canOverlay?y(reading.wlDesign):null};
  }
  function vector(site,sec,reading,now){
    const {s,levels,y,min,max,waterY}=model(site,sec,reading,now);
    const id='svg-'+sec.id.replace(/[^a-z0-9-]/gi,'');
    const comps=sec.components;
    const crest=levels.find(l=>l.kind==='crest'),face=comps.find(c=>['stone-facing','riprap'].includes(c.id))?.levels[0],toe=comps.find(c=>c.id==='toe-riprap')?.levels[0];
    const cy=crest?y(crest.value):145,fy=face?y(face.value):220,ty=toe?y(toe.value):315;
    const color={concrete:'#78889d',sand:'#b69764',earth:'#526549',stone:'#65798a',steel:'#c4b5fd'};
    const anchors={};
    const find=id=>comps.find(c=>c.id===id);
    const group=(cid,content,x,yy)=>{
      if(!find(cid))return '';
      anchors[cid]=[x,yy];
      const c=find(cid),n=comps.indexOf(c)+1;
      return `<g class="svg-component" data-focus-component="${esc(cid)}" tabindex="0" role="button" aria-label="${n}. ${esc(c.label)}"><title>${esc(c.label+' · '+c.detail)}</title>${content}</g>`;
    };
    const rect=(cid,x,yy,w,h,fill)=>group(cid,`<rect x="${x}" y="${yy}" width="${w}" height="${h}" fill="${fill}" stroke="#d0dae5" stroke-width="1.5"/>`,x+w/2,yy+h/2);
    const path=(cid,d,fill,x,yy,stroke='#bcc9d6')=>group(cid,`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,x,yy);
    let shapes='';
    if(sec.scene==='pile-detail'){
      const pile=comps.find(c=>/^pile-[abc]$/.test(c.id));
      shapes+=rect(pile.id,150,160,430,65,color.concrete);
      shapes+=path('pc-strand','M160 174 H565 M160 210 H565','none',405,174,color.steel);
      shapes+=path('dowel','M160 186 H300 M160 201 H300','none',225,195,'#fbbf24');
      shapes+=group('pile-ties',Array.from({length:24},(_,i)=>`<path d="M${160+i*17} 166 l12 53 l5 -53" fill="none" stroke="#dae6f3"/>`).join(''),365,193);
      shapes+=path('lifting-point','M220 160 v-22 q10 -20 20 0 v22 M490 160 v-22 q10 -20 20 0 v22','none',225,139,'#fbbf24');
      shapes+=path('pile-tip','M580 160 l42 32 l-42 33 Z',color.steel,601,193);
    }else if(sec.scene==='railing-detail'){
      shapes+=rect('rail-footing',120,296,520,30,color.concrete);
      shapes+=group('railing',[150,290,430,580].map(x=>`<rect x="${x}" y="138" width="9" height="156" fill="${color.steel}"/>`).join(''),290,210);
      shapes+=path('rail-horizontal','M150 146 H588 M150 196 H588 M150 246 H588','none',390,146,color.steel);
      shapes+=group('rail-baseplate',[150,290,430,580].map(x=>`<rect x="${x-11}" y="286" width="32" height="9" fill="#fbbf24"/>`).join(''),430,290);
      shapes+=path('rail-anchor','M148 285 v30 M164 285 v30','none',148,310,'#fbbf24');
      shapes+=rect('rail-galvanizing',146,134,8,144,'#dbeafe');
    }else if(['manhole','small-drain'].includes(sec.scene)){
      shapes+=path('drain-chamber','M210 145 H505 V320 H210 Z M238 169 V285 H478 V169 Z',color.concrete,219,223);
      shapes+=rect('chamber-base',210,285,295,35,color.concrete);
      shapes+=rect('chamber-cover',204,132,306,15,'#aab6c4');
      shapes+=path('cover-frame','M204 129 H510 M206 128 v19 M510 128 v19','none',210,131,'#fbbf24');
      shapes+=path('ladder-rungs','M473 183 h-20 v8 h20 M473 211 h-20 v8 h20 M473 239 h-20 v8 h20','none',460,214,color.steel);
      shapes+=path('drain-pipe','M110 245 H232 V275 H110 M478 245 H650 V275 H478','none',530,253,'#38bdf8');
      shapes+=path('chamber-steel','M225 155 V302 H490 V155','none',225,290,color.steel);
      shapes+=rect('pipe-bedding',204,320,309,14,color.sand);
      shapes+=rect('drain-gutter',120,192,82,40,color.concrete);
      shapes+=group('grating','<path d="M208 147 H500" stroke="#fbbf24" stroke-width="10" stroke-dasharray="5 9"/>',370,147);
      shapes+=rect('s0',530,284,84,12,color.concrete);
      shapes+=path('geotextile','M205 326 H620','none',550,327,'#fbbf24');
    }else{
      // Pixel geometry below communicates topology only. Numeric y() is used
      // exclusively for source-linked spot anchors, not an unknown pile/ground.
      shapes+=path('earth-fill',`M92 ${cy-10} H160 L280 ${cy+70} L350 ${cy+40} V${cy+4} H92 Z`,color.earth,185,cy+17);
      for(const cid of ['sand','backfill-sand','backfill-sand','backfill-sand'])if(!anchors[cid])shapes+=path(cid,`M226 ${cy+25} L328 ${cy+31} V${fy+35} L206 ${cy+65} Z`,color.sand,274,cy+65);
      shapes+=rect('footpath',95,cy-5,143,10,color.concrete);
      shapes+=rect('crest',238,cy,128,25,color.concrete);
      shapes+=rect('gb2',176,cy,54,25,color.concrete);
      shapes+=rect('panel',336,cy+27,14,Math.max(55,fy-cy+10),color.concrete);
      for(const cid of ['geotextile','back-geotextile'])shapes+=path(cid,`M330 ${cy+28} V${fy+44}`,'none',330,cy+70,'#fbbf24');
      const endY=Math.max(fy+45,ty),endX=toe?540:620;
      shapes+=path(find('stone-facing')?'stone-facing':'riprap',`M355 ${fy} H387 L${endX} ${endY} L${endX-22} ${endY+10} L368 ${fy+28} H350 Z`,`url(#${id}-rock)`,450,(fy+endY)/2);
      shapes+=path('slope-sand',`M368 ${fy+32} L${endX-20} ${endY+19} L${endX-65} ${endY+20} L365 ${fy+55} Z`,color.sand,440,(fy+endY)/2+23);
      shapes+=path('slope-geotextile',`M368 ${fy+30} L${endX-22} ${endY+12}`,'none',440,(fy+endY)/2+13,'#fbbf24');
      shapes+=path('stone-chinking',`M398 ${fy+20} l10 5 M425 ${fy+38} l10 5 M449 ${fy+56} l10 5`,'none',410,fy+25,'#c8d8e6');
      shapes+=path('toe-riprap',`M540 ${ty} H590 L654 ${ty+33} H554 Z`,`url(#${id}-rock)`,590,ty+15);
      shapes+=rect('mattress',530,ty+37,118,12,'url(#'+id+'-mesh)');
      shapes+=path('mattress-stone',`M545 ${ty+42} H630`,'none',598,ty+42,color.stone);
      shapes+=path('ground-cut',`M120 ${cy+25} L285 ${fy+40} L600 ${ty+46}`,'none',205,cy+60,'#ac9271');
      shapes+=path('existing-ground',`M84 ${cy+12} H139 L280 ${fy+38} L660 ${ty+57}`,'none',153,cy+12,'#9aad87');
      shapes+=rect('s0',358,fy-5,45,10,color.concrete);
      shapes+=group('railing',`<path d="M356 ${cy} v-43 M325 ${cy} v-43 M325 ${cy-40} H356 M325 ${cy-22} H356" stroke="${color.steel}" stroke-width="3"/>`,355,cy-25);
      shapes+=rect('drain-chamber',163,cy+5,30,48,color.concrete);
      shapes+=rect('drain-gutter',118,cy+3,39,15,color.concrete);
      shapes+=path('drain-pipe',`M179 ${cy+40} L399 ${fy-15} v13 L179 ${cy+53} Z`,'#384c68',245,cy+44);
      if(sec.scene==='stairs'){
        shapes+=path('stairs',`M350 ${cy+4} h18 v18 h18 v18 h18 v18 h18 v18 h18 v18 h18 v18 h18 v18`,'none',417,cy+75,'#e2e8f0');
        shapes+=rect('stairs-landing',330,cy-6,45,10,color.concrete);
        shapes+=path('bst',`M345 ${cy+19} L495 ${cy+147}`,'none',412,cy+85,'#78889d');
        shapes+=rect('column-c1',482,cy+137,12,45,color.concrete);
        shapes+=path('stair-steel',`M353 ${cy+24} L488 ${cy+142}`,'none',437,cy+98,color.steel);
        shapes+=path('riprap-transition',`M496 ${cy+148} L578 ${cy+175}`,'none',545,cy+164,color.stone);
      }
      if(sec.scene?.startsWith('drain-')){
        const type=sec.scene.at(-1);
        shapes+=path('pipe-bedding',`M180 ${cy+57} L403 ${fy+3}`,'none',235,cy+65,color.sand);
        if(type!=='1')shapes+=path('headwall',`M125 ${fy-15} L156 ${cy+25} H190 V${fy+16} Z`,color.concrete,151,fy);
        if(type==='3'){
          shapes+=rect('catchment-floor',119,fy+21,78,13,color.concrete);
          shapes+=path('drain-pipe',`M186 ${cy+60} L400 ${fy+13} v13 L186 ${cy+73} Z`,'#384c68',274,cy+65);
        }
        shapes+=path('headwall-steel',`M133 ${fy-10} L158 ${cy+31} H182`,'none',155,fy-5,color.steel);
      }
      shapes+=rect('wall-w1',344,cy+25,19,Math.max(55,fy-cy),color.concrete);
      shapes+=rect('slab-sd',265,fy-5,85,10,color.concrete);
      shapes+=rect('gb1a',238,fy+13,127,24,color.concrete);
      shapes+=group('pipe-collar',`<circle cx="362" cy="${fy-15}" r="20" fill="none" stroke="#aab6c4" stroke-width="6"/>`,362,fy-15);
      shapes+=path('weep-hole',`M344 ${fy+15} h26`,'none',360,fy+15,'#38bdf8');
      shapes+=path('gb1-steel',`M246 ${cy+7} H358 M246 ${cy+18} H358`,'none',280,cy+12,color.steel);
      shapes+=path('panel-steel',`M342 ${cy+35} V${fy+32}`,'none',341,cy+48,color.steel);
      // Piles are in a visibly separate schematic band: no fabricated cut-off/toe.
      for(const [cid,x] of [['pile-b',270],['pile-a',330],['pile-c',460],['pile-d',520],['pile-d-upper',430],['pile-d-middle',500],['pile-d-lower',565]])
        shapes+=group(cid,`<path d="M${x} 393 v56 l7 13 l7 -13 v-56 Z" fill="${color.concrete}" stroke="#c4b5fd"/>`,x+7,415);
    }
    // Any detail item has a distinct visible schematic glyph, never disappears.
    const extras=comps.filter(c=>!anchors[c.id]);
    shapes+=extras.map((c,i)=>{
      const x=91+(i%6)*88,yy=490+Math.floor(i/6)*38;
      return rect(c.id,x,yy,66,22,'#384c68');
    }).join('');
    const marker=(c,i)=>{
      const [x,yy]=anchors[c.id];return `<g class="svg-marker" data-focus-component="${esc(c.id)}" tabindex="0" role="button" aria-label="${i+1}. ${esc(c.label)}"><circle cx="${x}" cy="${yy}" r="11" fill="#0c172b" stroke="#7dd3fc"/><text x="${x}" y="${yy+4}" text-anchor="middle" font-size="11" fill="#e0f2fe">${i+1}</text></g>`;
    };
    const h=Math.max(560,246+comps.length*25,530+Math.ceil(extras.length/6)*38);
    const grid=Array.from({length:5},(_,i)=>{const val=max-(max-min)*i/4;const yy=y(val);return `<path d="M72 ${yy} H684" stroke="#25334b" stroke-dasharray="3 5"/><text x="65" y="${yy+4}" text-anchor="end" fill="#7e94b1" font-size="11">${val.toFixed(2)}</text>`;}).join('');
    let lastLabelY=75;
    const labels=[...levels].sort((a,b)=>b.value-a.value).map(l=>{
      const lineY=y(l.value),labelY=Math.max(lineY-5,lastLabelY+18);lastLabelY=labelY;
      return `<g class="spot-level"><path d="M76 ${lineY} H683" stroke="${l.color}" opacity=".65" stroke-dasharray="6 5"/><path d="M78 ${lineY} V${labelY}" stroke="${l.color}" opacity=".6"/><rect x="78" y="${labelY-12}" width="236" height="16" fill="#101b2d" opacity=".92"/><text x="82" y="${labelY}" font-size="10" fill="${l.color}">${esc(l.label)} ${signed(l.value)} ม.</text></g>`;
    });
    const spot=labels.join('');
    const stamp=s.reading&&Number.isFinite(Date.parse(reading.measuredAt))?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(reading.measuredAt)):'—';
    let water='';
    if(s.canOverlay){
      water=`<g class="water-layer" data-water-value="${Number(reading.wlDesign)}" data-water-y="${waterY}" clip-path="url(#${id}-water-clip)"><path class="water-fill" d="M76 ${waterY} H684 V370 H76 Z" fill="url(#${id}-water)"/><g class="water-surface"><path d="M76 ${waterY} H684" stroke="${s.color}" stroke-width="2.5"/><path class="water-wave ${s.status==='LIVE'?'moving':''}" d="M-600 0 ${Array.from({length:48},()=> 'q12 -4 24 0 t24 0').join(' ')}" transform="translate(76 ${waterY})" fill="none" stroke="#a5e5ff" opacity=".6"/></g></g><text class="water-caption" x="680" y="${Math.max(101,waterY-8)}" text-anchor="end" fill="${s.color}" font-size="14" font-weight="700">น้ำ ${signed(reading.wlDesign)} ม. (derived station)</text>`;
    }
    const detailOnly=['pile-detail','railing-detail','manhole','small-drain'].includes(sec.scene);
    if(detailOnly)water='';
    const clip=`M76 75 H684 V370 L660 ${ty+57} L${toe?540:620} ${Math.max(fy+45,ty)} L387 ${fy} H366 V${cy} H76 Z`;
    return `<svg class="section-svg ${s.status==='LIVE'?'is-live':''}" data-section-svg="${esc(sec.id)}" data-domain-min="${min}" data-domain-max="${max}" viewBox="0 0 1060 ${h}" role="img" aria-label="${esc(sec.name)} — ทุก component และระดับน้ำ ${s.status}">
      <defs><pattern id="${id}-rock" width="22" height="18" patternUnits="userSpaceOnUse"><rect width="22" height="18" fill="#5c7084"/><path d="M1 5 L8 1 L17 5 L20 12 L13 17 L4 13 Z" fill="none" stroke="#99abbc" stroke-width="1"/></pattern><pattern id="${id}-mesh" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#64748b"/><path d="M0 0 L10 10 M0 10 L10 0" stroke="#b4c1cf" stroke-width=".6"/></pattern><linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#38bdf8" stop-opacity=".35"/><stop offset="1" stop-color="#0ea5e9" stop-opacity=".07"/></linearGradient><clipPath id="${id}-water-clip"><path d="${clip}"/></clipPath></defs>
      <rect width="1060" height="${h}" rx="12" fill="#101b2d"/>
      <text x="28" y="30" fill="#e2e8f0" font-size="16" font-weight="700">${esc(sec.name)}</text><text x="28" y="54" fill="#93a9c7" font-size="11">รูป component เป็น schematic · เฉพาะเส้น spot elevation / น้ำ ใช้แกนระดับจริง · ไม่ใช่ as-built</text>
      <text x="28" y="75" fill="${s.color}" font-size="12">${s.reading?`น้ำจริง ${signed(s.canOverlay&&!detailOnly?reading.wlDesign:reading.wlMsl)} ${s.canOverlay&&!detailOnly?'ม. สเกลแบบ':'ม.รทก.'} · ${s.status}`:'NO DATA — ไม่มีข้อมูลน้ำ'}${site.datumOffsetLocal?' · แยกสเกลจากแบบ':''}</text>
      ${detailOnly?'':grid}
      <g class="structure-layer">${shapes}</g>${detailOnly?'':spot}${water}
      <rect x="74" y="381" width="612" height="91" fill="#0c1525" opacity=".94" rx="6"/>
      ${Object.entries(anchors).filter(([cid])=>/^pile-[abcd]/.test(cid)&&!detailOnly).map(([cid])=>{const [x]=anchors[cid];return `<path d="M${x-7} 393 v56 l7 13 l7 -13 v-56 Z" fill="#78889d" stroke="#c4b5fd"/>`;}).join('')}
      <text x="82" y="465" fill="#9aadc7" font-size="10">${detailOnly?'รายละเอียด schematic — ไม่มี absolute elevation ใช้ผูกกับน้ำ':'เสาเข็ม schematic — ระดับหัว/ปลายที่แบบไม่ระบุ = [ต้องกรอก] · ไม่อยู่บนแกนระดับด้านบน'}</text>
      ${comps.map(marker).join('')}
      <path d="M710 76 V${h-20}" stroke="#2b3b53"/>
      <circle cx="742" cy="92" r="5" fill="${s.color}"/><text x="755" y="97" fill="${s.color}" font-size="12" font-weight="700">${s.status} · ${esc(site.stationCode||reading?.stationId||'station')}</text>
      <text x="733" y="122" fill="#7dd3fc" font-size="17" font-weight="700">${s.reading?`${signed(reading.wlMsl)} ม.รทก.`:'ไม่มีข้อมูลน้ำ'}</text>
      <text x="733" y="145" fill="#94a3b8" font-size="11">เวลาอ่าน ${esc(stamp)}</text>
      <text x="733" y="166" fill="${site.datumOffsetLocal?'#fbbf24':'#94a3b8'}" font-size="11">${site.datumOffsetLocal?'แยกสเกล: แบบ local / station MSL':'ข้อมูล station ไม่ใช่ sensor หน้างาน'}</text>
      ${site.datumOffsetLocal?'<text x="733" y="186" fill="#fbbf24" font-size="11">ยังไม่ผูก BM — ไม่แสดงเส้นน้ำทับแบบ</text>':''}
      ${comps.map((c,i)=>`<g class="svg-legend-item" data-focus-component="${esc(c.id)}" tabindex="0" role="button" aria-label="ดู ${esc(c.label)}"><rect x="729" y="${205+i*25}" width="305" height="23" rx="4" fill="#18263c"/><text x="736" y="${220+i*25}" fill="#e2e8f0" font-size="11">${i+1}. ${esc(c.label)}</text><title>${esc(c.detail)}</title></g>`).join('')}
      </svg>`;
  }
  // DOM is replaced for a new reading; restore the old real value's position in
  // the NEW domain, then interpolate visually. Text never interpolates numbers.
  function animate(container,previous){
    if(!previous||typeof root.matchMedia==='function'&&root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(const svg of container.querySelectorAll('[data-section-svg]')){
      const layer=svg.querySelector('.water-layer'),old=previous.get(svg.dataset.sectionSvg);
      if(!layer||!old||old.value===Number(layer.dataset.waterValue))continue;
      const oldY=86+(Number(svg.dataset.domainMax)-old.value)/(Number(svg.dataset.domainMax)-Number(svg.dataset.domainMin))*250;
      const delta=oldY-Number(layer.dataset.waterY);
      if(Number.isFinite(delta)&&Math.abs(delta)<250)layer.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0px)'}],{duration:900,easing:'ease-out'});
    }
  }
  const api={vector,state,model,animate,esc};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SamcoSectionAnimation=api;
})(typeof window==='undefined'?globalThis:window);
