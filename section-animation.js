/* Source-linked elevations only. Other geometry is a schematic transcription.
 * Coordinates in this renderer are display coordinates, NOT inferred dimensions.
 * No raster drawings, invented levels, or placeholder component rectangles.
 */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>v!=null&&v!==''&&Number.isFinite(Number(v));
  const signed=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(3)}`;
  const DETAIL=['pile-detail','railing-detail','manhole','small-drain','pipe-front','stairs','cap'];
  const profiles={
    'thachin-nakhonchaisi':{cap:170,wall:640,end:1000,drop:200,layer:48,back:120},
    'khoksalut-nan':{cap:110,wall:550,end:970,drop:185,layer:18,back:100},
    'angthong-bangkaew':{cap:130,wall:570,end:970,drop:200,layer:18,back:115},
    'prachinburi':{cap:150,wall:620,end:970,drop:155,layer:38,back:130},
    'buengkan-nam-hi':{cap:150,wall:620,end:970,drop:180,layer:50,back:145},
  };
  function state(site,reading,now=Date.now()){
    if(!reading||reading.siteId!==site.id||!finite(reading.wlMsl))return {status:'NO DATA',color:'#64748b',reading:null,canOverlay:false};
    const time=Date.parse(reading.measuredAt),cadence=Number(reading.cadenceMinutes),age=(now-time)/60000;
    const status=!Number.isFinite(time)||age<0||!finite(cadence)||cadence<=0?'UNKNOWN':age<=cadence*2?'LIVE':age<=cadence*4?'DELAYED':'STALE';
    return {status,color:status==='LIVE'?'#0369a1':status==='STALE'?'#b91c1c':'#92400e',reading,canOverlay:!site.datumOffsetLocal&&finite(reading.wlDesign)&&Number.isFinite(time)};
  }
  function model(site,sec,reading,now){
    const s=state(site,reading,now),levels=sec.components.flatMap(c=>c.levels);
    const vals=[...levels.map(l=>l.value),...(sec.referenceWaterLevels||[]).map(l=>l.value)];
    if(s.canOverlay)vals.push(Number(reading.wlDesign));
    const min=vals.length?Math.min(...vals)-1:0,max=vals.length?Math.max(...vals)+1:1;
    const y=v=>180+(max-Number(v))/(max-min)*360;
    return {s,levels,min,max,y,waterY:s.canOverlay?y(reading.wlDesign):null};
  }
  function geometry(site,sec,m,prefix){
    const cfg=profiles[site.id];if(!cfg)throw Error('Drawing profile missing: '+site.id);
    const comps=sec.components,has=id=>comps.some(c=>c.id===id),anchors={},pieces=[];
    const lev=id=>comps.find(c=>c.id===id)?.levels[0]?.value;
    const cy=finite(lev('crest'))?m.y(lev('crest')):240;
    const face=has('stone-facing')?'stone-facing':'riprap';
    const fy=finite(lev(face))?m.y(lev(face)):cy+90;
    const ty=finite(lev('toe-riprap'))?m.y(lev('toe-riprap')):Math.min(540,fy+cfg.drop);
    const ax=cfg.wall,bx=ax-cfg.cap+20,end=cfg.end;
    const ink='#334155',concrete=`url(#${prefix}-concrete)`,sand=`url(#${prefix}-sand)`,rock=`url(#${prefix}-rock)`;
    const put=(id,html,x,y)=>{if(!has(id))return;anchors[id]=[x,y];const c=comps.find(c=>c.id===id);pieces.push(`<g class="svg-component" data-focus-component="${esc(id)}" tabindex="0" role="button" aria-label="${esc(c.label)}"><title>${esc(c.detail)}</title>${html}</g>`);};
    const path=(id,d,x,y,fill='none',stroke=ink)=>put(id,`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`,x,y);
    const rect=(id,x,y,w,h,fill=concrete)=>path(id,`M${x} ${y} h${w} v${h} h-${w} Z`,x+w/2,y+h/2,fill);
    const pile=(id,x,head,endY=650)=>{
      const split=Math.max(head+42,Math.min(570,head+150));
      path(id,`M${x-7} ${head} V${split-5} M${x+7} ${head} V${split-5} M${x-7} ${split+9} V${endY-13} L${x} ${endY} L${x+7} ${endY-13} V${split+9} M${x-12} ${split} l7 -4 l10 8 l7 -4 M${x-12} ${split+5} l7 -4 l10 8 l7 -4`,x,split+35);
    };
    const outline=`M340 ${cy+20} H${bx-cfg.back} L${bx-30} ${cy+20} L${ax} ${fy+cfg.layer} L${end} ${ty+cfg.layer} H1070`;
    let clip=`M${ax+8} 140 H1100 V${ty+cfg.layer+40} L${end} ${ty+cfg.layer} L${ax+50} ${fy} H${ax+8} V${cy} Z`;
    if(sec.scene==='pile-detail'){
      const id=comps.find(c=>/^pile-[abc]$/.test(c.id)).id;
      rect(id,420,315,590,60);
      path('pc-strand','M435 329 H1003 M435 360 H1003',830,329);
      path('dowel','M421 342 H625 M421 353 H625',520,347,'none','#7c3aed');
      const ties=[];
      for(const [from,to,gap]of [[435,535,8],[535,640,14],[640,825,25],[825,915,14],[915,995,8]])for(let x=from;x<to;x+=gap)ties.push(`<path d="M${x} 320 l${gap-2} 49 l2 -49" fill="none" stroke="#64748b"/>`);
      put('pile-ties',ties.join(''),710,340);
      path('lifting-point','M535 315 v-25 q12 -16 24 0 v25 M865 315 v-25 q12 -16 24 0 v25',548,283);
      path('pile-tip','M1010 315 l35 30 l-35 30 Z',1028,345,concrete);
      const isA=id==='pile-a',sectionHeight=isA?94:76,head=isA?'M550 490 h70 v20 h-17 v54 h17 v20 h-70 v-20 h17 v-54 h-17 Z':`M550 490 h70 v${sectionHeight} h-70 Z`;
      pieces.push(`<g class="view-inset"><text x="510" y="466" font-size="15" fill="#475569">หน้าตัดหัว / ช่วงตัวเข็ม · ไม่ใช่แกนระดับ</text><path d="${head}" fill="${concrete}" stroke="${ink}"/><path d="M780 490 h70 v${sectionHeight} h-70 Z" fill="${concrete}" stroke="${ink}"/><path d="M786 497 h58 v${sectionHeight-14} h-58 Z" fill="none" stroke="#64748b"/>${[0,1,2,3,...(isA?[4,5,6]:[])].map((_,i)=>{const x=i<4?(i%2?836:794):i===4?815: i===5?794:836;const yy=i<4?(i<2?505:490+sectionHeight-15):490+sectionHeight/2;return `<circle cx="${x}" cy="${yy}" r="3" fill="#475569"/>`;}).join('')}</g>`);clip='';
    }else if(sec.scene==='railing-detail'){
      rect('rail-footing',405,460,610,28);
      put('railing',[440,610,780,950].map(x=>`<path d="M${x} 245 h9 v210 h-9 Z" fill="#e2e8f0" stroke="${ink}"/>`).join(''),610,350);
      path('rail-horizontal','M440 255 H958 M440 315 H958 M440 375 H958',810,255);
      put('rail-baseplate',[440,610,780,950].map(x=>`<rect x="${x-14}" y="451" width="38" height="9" fill="#e2e8f0" stroke="${ink}"/>`).join(''),794,455);
      path('rail-anchor','M430 453 v31 h9 M462 453 v31 h-9',430,476);
      path('rail-galvanizing','M437 245 V448',437,295,'none','#0891b2');clip='';
    }else if(sec.scene==='small-drain'){
      // PDF 66 has a narrow gutter/chamber, not the large MH section of PDF 61.
      path('drain-gutter','M395 285 h16 v112 h50 v-112 h16 v130 h-82 Z',404,350,concrete);
      path('drain-chamber','M540 255 H646 V480 H540 Z M555 274 H631 V463 H555 Z',547,355,concrete);
      rect('chamber-cover',534,245,118,10);
      put('grating',Array.from({length:9},(_,i)=>`<path d="M${399+i*9} 279 v10" stroke="${ink}"/>`).join(''),435,283);
      path('drain-pipe','M645 445 L1000 535 v12 L645 457 Z',815,492,concrete);
      rect('pipe-bedding',534,482,118,12,sand);
      rect('s0',984,520,75,10);
      path('geotextile','M974 510 V575',974,552,'none','#0891b2');clip='';
    }else if(sec.scene==='manhole'){
      path('drain-chamber','M515 250 H880 V505 H515 Z M540 275 H855 V475 H540 Z',523,345,concrete);
      rect('chamber-base',515,475,365,30);rect('chamber-cover',505,230,385,20);
      path('cover-frame','M505 228 H890 M505 228 v22 M890 228 v22',505,237);
      path('ladder-rungs','M849 295 h-30 v9 h30 M849 335 h-30 v9 h30 M849 375 h-30 v9 h30',833,340);
      path('drain-pipe','M395 392 H540 V426 H395 M855 392 H1020 V426 H855',932,407);
      path('chamber-steel','M528 263 V491 H868 V263',528,455,'none','#7c3aed');
      rect('pipe-bedding',500,507,400,15,sand);rect('drain-gutter',380,270,110,54);
      put('grating',Array.from({length:18},(_,i)=>`<path d="M${520+i*20} 230 v19" stroke="${ink}"/>`).join(''),700,238);
      rect('s0',920,467,95,10);path('geotextile','M500 525 H1015',965,525,'none','#0891b2');clip='';
    }else if(sec.scene==='pipe-front'){
      // PDF 60: front elevation, with a separate double-outlet inset.
      rect('crest',435,245,570,28);rect('wall-w1',590,273,275,174);
      put('drain-pipe','<circle cx="735" cy="363" r="45" fill="#f8fafc" stroke="#334155" stroke-width="2"/>',735,363);
      put('pipe-collar','<circle cx="735" cy="363" r="55" fill="none" stroke="#64748b" stroke-width="5"/>',786,363);
      rect('gb1a',570,472,315,30);rect('slab-sd',590,449,275,12);rect('pipe-bedding',590,462,275,9,sand);
      put('panel',`<path d="M450 278 H584 V445 H450 Z M871 278 H990 V445 H871 Z" fill="${concrete}" stroke="${ink}"/>`,510,365);
      pile('pile-a',560,273);pile('pile-b',940,273);
      pieces.push('<g class="view-inset"><text x="665" y="565" font-size="15" fill="#475569">รูปด้านท่อคู่ · เลือกตามตำแหน่งงาน</text><path d="M660 580 H858 V678 H660 Z" fill="none" stroke="#64748b"/><circle cx="717" cy="626" r="28" fill="none" stroke="#64748b"/><circle cx="801" cy="626" r="28" fill="none" stroke="#64748b"/></g>');clip='';
    }else if(sec.scene==='stairs'){
      // PDF 49 A-A is independent of the river-normal typical.
      rect('crest',430,310,110,24);rect('stairs-landing',875,255,130,18);
      pieces.push('<g class="view-inset"><rect x="400" y="275" width="160" height="78" fill="none" stroke="#cbd5e1"/><text x="412" y="296" font-size="13" fill="#64748b">GB1 · อ้างอิง typical</text></g>');
      path('stairs',`M455 435 H555 ${Array.from({length:10},()=> 'h30 v-18').join(' ')} H1005`,700,345);
      path('bst','M445 452 H560 L875 281 H1005',747,350);
      path('column-c1','M895 281 h16 v215 h-16 Z M983 281 h16 v215 h-16 Z',905,402,concrete);
      pile('pile-c',905,496);
      path('stair-steel','M560 447 L879 272 H997',670,385,'none','#7c3aed');
      path('railing','M463 432 V352 H553 L875 174 H1000 V255 M553 352 V434 M660 293 V374 M770 231 V308 M890 175 V255 M553 329 L875 151 H1000',770,231);
      path('riprap','M455 468 H550 L1000 520 H1060 V548 H455 Z',700,511,rock);
      path('riprap-transition','M500 490 L700 545',587,514);
      pieces.push('<text x="470" y="590" font-size="15" fill="#475569">รูปตัด A–A / C1 / BST · ระดับชานพัก [ต้องกรอก]</text>');clip='';
    }else{
      path('earth-fill',`M${bx-cfg.back} ${cy+20} L${bx-25} ${cy} H${bx} V${cy+30} L${bx-25} ${cy+44} Z`,bx-68,cy+21,`url(#${prefix}-earth)`);
      path(has('sand')?'sand':'backfill-sand',`M${bx+9} ${cy+25} H${ax-9} V${fy+60} L${ax-85} ${fy+60} L${bx+9} ${cy+65} Z`,ax-42,cy+60,sand);
      path('existing-ground',outline,bx-cfg.back,cy+20);
      path('ground-cut',`M${bx+10} ${cy+50} L${ax+80} ${ty+25} L${end-100} ${ty+25}`,ax+80,ty+25);
      path('slope-sand',`M${ax+4} ${fy+cfg.layer} L${end} ${ty+cfg.layer} L${end-96} ${ty+65} L${ax+4} ${fy+85} Z`,ax+156,(fy+ty)/2+48,sand);
      path(face,`M${ax+4} ${fy} H${ax+50} L${end} ${ty} L${end-26} ${ty+cfg.layer} L${ax+4} ${fy+cfg.layer} Z`,ax+150,(fy+ty)/2,rock);
      path('slope-geotextile',`M${ax+4} ${fy+cfg.layer} L${end-26} ${ty+cfg.layer}`,ax+128,(fy+ty)/2+cfg.layer,'none','#0891b2');
      path('stone-chinking',`M${ax+73} ${fy+17} l14 5 M${ax+109} ${fy+35} l14 5 M${ax+145} ${fy+53} l14 5`,ax+110,fy+40);
      path('toe-riprap',`M${end-70} ${ty} H${end+5} L${end+80} ${ty+65} H${end-125} Z`,end-26,ty+40,rock);
      rect('mattress',end+20,ty+69,90,10,`url(#${prefix}-mesh)`);path('mattress-stone',`M${end+30} ${ty+72} H${end+95}`,end+55,ty+72);
      rect('crest',bx-8,cy,cfg.cap+22,24);rect('footpath',bx-54,cy-8,48,10);rect('gb2',bx-68,cy,54,24);
      const panelX=sec.id==='thachin-2'?bx+3:ax-6;
      rect('panel',panelX,cy+24,9,Math.max(44,fy-cy+60));
      for(const id of ['geotextile','back-geotextile'])path(id,`M${panelX-5} ${cy+26} V${fy+60}`,panelX-5,cy+54,'none','#0891b2');
      const s0Y=sec.scene==='drain-3'?m.y(lev('pipe-mouth-level')):fy-5;
      rect('s0',ax+13,s0Y,45,7);
      path('railing',`M${ax+9} ${cy} v-50 h-5 v50 M${ax+4} ${cy-45} h6 M${ax+4} ${cy-28} h6`,ax+7,cy-27);
      rect('drain-gutter',bx-63,cy+3,35,18);rect('drain-chamber',bx-118,cy-8,27,64);
      const startX=['drain-2','drain-3'].includes(sec.scene)?bx-170:bx-103;
      const startY=sec.scene==='drain-3'?m.y(lev('catchment-floor'))-20:sec.scene==='drain-2'?m.y(lev('pipe-mouth-level'))-8:cy+40;
      path('drain-pipe',`M${startX} ${startY} L${ax+65} ${fy-12} v16 L${startX} ${startY+16} Z`,(startX+ax+65)/2,(startY+fy)/2,concrete);
      path('pipe-bedding',`M${startX} ${startY+19} L${ax+65} ${fy+7}`,(startX+ax+65)/2,(startY+fy)/2+19);
      path('gb1-steel',`M${bx} ${cy+6} H${ax+7} M${bx} ${cy+18} H${ax+7}`,bx+53,cy+12,'none','#7c3aed');
      path('panel-steel',`M${panelX+4} ${cy+33} V${fy+56}`,panelX+4,fy+22,'none','#7c3aed');
      path('weep-hole',`M${panelX} ${fy+25} h14`,panelX+7,fy+25,'none','#0369a1');
      const swapped=sec.id==='thachin-2';
      pile('pile-a',swapped?bx+6:ax,cy+24);pile('pile-b',swapped?ax:bx+6,cy+24);
      for(const [cid,x] of [['pile-d-upper',ax+42],['pile-d-middle',ax+85],['pile-d-lower',ax+128]])if(has(cid)){
        pile(cid,x,m.y(lev(cid)),640);pile(cid,x+22,m.y(lev(cid)),640);
      }
      if(has('pile-d'))for(let i=0;i<5;i++)pile('pile-d',ax+105+i*32,finite(lev('pile-d'))?m.y(lev('pile-d')):fy+22+i*15,655);
      // Nan only references stair detail: separate inset, not a fake stair on slope.
      path('stairs','M865 645 h25 v-12 h25 v-12 h25 v-12 h25 v-12 h25',916,622);
      if(sec.scene?.startsWith('drain-')){
        const type=sec.scene.at(-1),mouthY=finite(lev('pipe-mouth-level'))?m.y(lev('pipe-mouth-level')):fy;
        if(type!=='1'){
          path('headwall',`M${bx-180} ${mouthY} V${mouthY-22} L${bx-38} ${cy+7} V${fy+22} H${bx-180} Z`,bx-115,mouthY-12,concrete);
          path('headwall-steel',`M${bx-170} ${mouthY+7} H${bx-50} V${cy+17}`,bx-66,mouthY+7,'none','#7c3aed');
          const markX=type==='3'?ax+13:bx-180;
          path('pipe-mouth-level',`M${markX} ${mouthY} h36`,markX+18,mouthY,'none','#0369a1');
          if(type==='3')rect('catchment-floor',bx-208,m.y(lev('catchment-floor')),160,13);
        }
        pieces.push(`<g class="view-inset"><text x="815" y="620" font-size="14" fill="#475569">รูปด้านปากท่อ · แบบ ${type}</text><path d="M805 705 L832 649 H1020 L1068 705 Z" fill="${concrete}" stroke="${ink}"/><circle cx="875" cy="680" r="22" fill="#f8fafc" stroke="${ink}"/>${type==='3'?`<circle cx="969" cy="680" r="22" fill="#f8fafc" stroke="${ink}"/>`:''}</g>`);
      }
      if(sec.scene==='cap')pieces.push(`<g class="view-inset"><text x="800" y="610" font-size="14" fill="#475569">แปลนปิดหัวท้ายเขื่อน</text><path d="M805 635 H1060 V705 H1035 V660 H830 V705 H805 Z" fill="${concrete}" stroke="${ink}"/></g>`);
    }
    const missing=comps.filter(c=>!anchors[c.id]);
    if(missing.length)throw Error('No source geometry for '+sec.id+': '+missing.map(c=>c.id).join(','));
    return {html:pieces.join(''),anchors,cy,fy,ty,ax,bx,clip,detailOnly:DETAIL.includes(sec.scene),profile:cfg};
  }
  function wrap(text,size=29){
    const parts=typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter('th',{granularity:'word'}).segment(text),x=>x.segment):Array.from(text);
    const lines=[];let current='';
    for(const part of parts){if(current&&Array.from(current+part).length>size){lines.push(current.trim());current='';}current+=part;}
    if(current)lines.push(current.trim());return lines;
  }
  function calloutLayout(sec,anchors){
    const sorted=sec.components.map((c,i)=>({c,n:i+1,anchor:anchors[c.id]})).sort((a,b)=>a.anchor[0]-b.anchor[0]);
    const split=Math.ceil(sorted.length/2),out=[];
    for(const [side,items] of [['left',sorted.slice(0,split)],['right',sorted.slice(split)]]){
      items.sort((a,b)=>a.anchor[1]-b.anchor[1]);let next=166;
      for(const item of items){const lines=wrap(item.c.label),height=Math.max(44,lines.length*19+14);out.push({...item,side,x:side==='left'?22:1132,y:next,width:246,height,lines});next+=height+10;}
    }return out;
  }
  function vector(site,sec,reading,now,options={}){
    const m=model(site,sec,reading,now),{s,levels,y,min,max,waterY}=m;
    const prefix='drawing-'+sec.id.replace(/[^a-z0-9-]/gi,'')+(options.compact?'-compact':'');
    const g=geometry(site,sec,m,prefix),layout=calloutLayout(sec,g.anchors),h=Math.max(780,...layout.map(l=>l.y+l.height+40));
    const stamp=s.reading&&Number.isFinite(Date.parse(reading.measuredAt))?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(reading.measuredAt)):'—';
    let last=150;
    const rail=levels.slice().sort((a,b)=>b.value-a.value).map(l=>{const yy=y(l.value),labelY=Math.max(yy,last+30);last=labelY;return `<g class="spot-level"><path d="M1075 ${yy} h12 l8 ${labelY-yy} h10" fill="none" stroke="#64748b"/><text x="1070" y="${labelY-7}" font-size="13" fill="#334155" text-anchor="end">${signed(l.value)}</text><title>${esc(l.label)} · ${signed(l.value)} ม.</title></g>`;}).join('');
    let water='';
    if(s.canOverlay&&!g.detailOnly)water=`<g class="water-layer" data-water-value="${Number(reading.wlDesign)}" data-water-y="${waterY}" clip-path="url(#${prefix}-water-clip)"><path d="M320 ${waterY} H1100 V610 H320 Z" fill="#bae6fd" opacity=".48"/><path d="M320 ${waterY} H1100" stroke="${s.color}" stroke-width="2.5"/></g>`;
    const callouts=layout.map(l=>{const [ax,ay]=l.anchor,start=l.side==='left'?292:1120,elbow=l.side==='left'?308:1110;return `<g class="svg-callout" data-focus-component="${esc(l.c.id)}" tabindex="0" role="button" aria-label="${esc(l.c.label)}" data-label-x="${l.x}" data-label-y="${l.y}" data-label-width="${l.width}" data-label-height="${l.height}"><path class="callout-leader" d="M${start} ${l.y+16} H${elbow} L${ax} ${ay}" fill="none" stroke="#94a3b8" stroke-width="1"/><circle cx="${ax}" cy="${ay}" r="2.5" fill="#475569"/><text x="${l.x}" y="${l.y+17}" fill="#0369a1" font-size="15" font-weight="700">${String(l.n).padStart(2,'0')}</text><text x="${l.x+30}" y="${l.y+17}" fill="#334155" font-size="15">${l.lines.map((line,i)=>`<tspan x="${l.x+30}" dy="${i?19:0}">${esc(line)}</tspan>`).join('')}</text><title>${esc(l.c.detail)}</title></g>`;}).join('');
    const view=options.compact?'260 145 855 590':`0 0 1400 ${h}`;
    return `<svg class="section-svg ${options.compact?'compact-svg':'full-svg'}" data-section-svg="${esc(sec.id)}" data-domain-min="${min}" data-domain-max="${max}" data-geometry-profile="${esc(site.id)}" viewBox="${view}" role="img" aria-label="${esc(sec.name)} — รูปตัด vector ทุก component · น้ำ ${s.status}">
      <defs><pattern id="${prefix}-concrete" width="27" height="23" patternUnits="userSpaceOnUse"><rect width="27" height="23" fill="#f1f5f9"/><path d="M5 6 l3 4 h-4 Z M19 18 h2" fill="none" stroke="#94a3b8" stroke-width=".7"/></pattern><pattern id="${prefix}-sand" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#fffbeb"/><circle cx="3" cy="3" r=".7" fill="#a8a29e"/><circle cx="10" cy="9" r=".7" fill="#a8a29e"/></pattern><pattern id="${prefix}-earth" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f5f5f4"/><path d="M0 12 L12 0 M0 0 L12 12" stroke="#a8a29e" stroke-width=".6"/></pattern><pattern id="${prefix}-rock" width="29" height="24" patternUnits="userSpaceOnUse"><rect width="29" height="24" fill="#f1f5f9"/><path d="M1 8 L9 1 L21 4 L27 14 L18 23 L6 20 Z" fill="none" stroke="#64748b" stroke-width=".8"/></pattern><pattern id="${prefix}-mesh" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 0 L9 9 M0 9 L9 0" stroke="#64748b" stroke-width=".5"/></pattern><clipPath id="${prefix}-water-clip"><path d="${g.clip}"/></clipPath></defs>
      <rect width="1400" height="${h}" fill="#fbfcfe"/>
      <g class="drawing-heading"><text x="30" y="42" font-size="23" font-weight="700" fill="#0f172a">${esc(sec.name)}</text><text x="30" y="69" font-size="15" fill="#64748b">${esc(sec.source.drawingNo)} · PDF ${sec.source.page} · แผ่น ${esc(sec.source.sheet)} · geometry schematic / ไม่ใช่ as-built</text><path d="M30 88 H1370" stroke="#cbd5e1"/>
      <text x="30" y="121" font-size="19" font-weight="700" fill="${s.color}">${s.reading?`น้ำ ${signed(s.canOverlay&&!g.detailOnly?reading.wlDesign:reading.wlMsl)} ${s.canOverlay&&!g.detailOnly?'ม. สเกลแบบ':'ม.รทก.'} · ${s.status}`:'NO DATA — ไม่มีข้อมูลน้ำ'}</text><text x="610" y="121" font-size="15" fill="#475569">${esc(site.stationCode||reading?.stationId||'station')} · ${esc(stamp)} · ${site.datumOffsetLocal?'แยกสเกล — ยังไม่ผูก BM':'station / ไม่ใช่ sensor หน้างาน'}</text></g>
      ${water}<g class="structure-layer">${g.html}</g>${g.detailOnly?'':rail}${options.compact?'':callouts}
      ${options.compact?'':`<text x="330" y="${h-32}" font-size="14" fill="#64748b">Break line: ความยาวเข็มย่อ · ระดับหัว/ปลายที่ไม่ระบุ [ต้องกรอก] · เส้นดิน schematic</text>`}
    </svg>`;
  }
  function animate(container,previous){
    if(!previous||typeof root.matchMedia==='function'&&root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(const svg of container.querySelectorAll('[data-section-svg]')){
      const layer=svg.querySelector('.water-layer'),old=previous.get(svg.dataset.sectionSvg);if(!layer||!old||old.value===Number(layer.dataset.waterValue))continue;
      const oldY=180+(Number(svg.dataset.domainMax)-old.value)/(Number(svg.dataset.domainMax)-Number(svg.dataset.domainMin))*360,delta=oldY-Number(layer.dataset.waterY);
      if(Number.isFinite(delta)&&Math.abs(delta)<360)layer.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0px)'}],{duration:350,easing:'ease-out'});
    }
  }
  const api={vector,state,model,geometry,calloutLayout,profiles,animate,esc};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SamcoSectionAnimation=api;
})(typeof window==='undefined'?globalThis:window);
