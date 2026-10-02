/* Transcribed from supplied A_01-05.pdf. No vertical calibration inferred.
 * Relative dimensions/specs are not spot elevations. Annotations are not instructions.
 */
(function(root){
  'use strict';
  const hash='81a0b264c0b56b2d52a5d0f5cf9700af901b3984606dda6781b9f29a4b1f007e';
  const src=(page)=>({file:'A_01-05.pdf',pdf:'assets/typical/buengkan-full.pdf',image:'',page,sheet:`${page-1} / 65`,drawingNo:`D670257 / แผ่น ${page-1}`,drawingDate:null,reviewedAt:'2026-10-02',sha256:hash,revisionStatus:'ชุดแบบเต็มจากเจ้าของงาน; annotation สี/ลายมือไม่ใช่ revision อนุมัติ'});
  const c=(id,label,detail,values=[],page)=>({id,label,detail,levels:values.map(([label,value,kind='component'])=>({label,value,kind,color:kind==='crest'?'#fbbf24':'#fb923c',verification:'ตรวจ spot elevation และ leader line ใน PDF'})),reference:page?`A_01-05.pdf · PDF หน้า ${page} · แผ่น ${page-1}`:'',missing:values.length?'':'ไม่มี absolute spot elevation ของ item นี้ในหน้าที่อ้าง; [ต้องกรอก] จากแบบ/สำรวจที่ผูก datum',...(page?{source:src(page)}:{})});
  function sections(base){
    const result=[];
    const add=(id,name,page,scene,components,dimensions=[])=>result.push({id:`buengkan-${id}`,name,source:src(page),scene,components,dimensions,referenceWaterLevels:base.referenceWaterLevels,chainage:null,datum:'local',notes:['ภาพ schematic ของ component ไม่ใช่ as-built; เฉพาะ spot elevation ที่ระบุใช้เทียบแกนระดับได้','ระดับแบบเป็น local datum จึงแสดงน้ำสถานี MSL แยกสเกล; ไม่คำนวณ freeboard','ข้อมูลที่อ่านไม่ชัด/ไม่มีระดับให้ [ต้องกรอก] ไม่ถอดระดับจาก pixel']});
    const anchors=()=>base.components.filter(c=>['crest','riprap'].includes(c.id)).map(c=>({...c,source:base.source,reference:'ระดับอ้างอิงรูปตัดทั่วไป: PDF หน้า 48 / แผ่น 47'}));
    add('stairs','บันไดเขื่อน · A–A / B–B',49,'stairs',[
      ...anchors(),c('stairs','พื้นบันได ค.ส.ล.','ลูกนอน 10×0.30=3.00 ม.; ลูกตั้ง 11×0.181=2.00 ม. เป็นมิติตามแบบ ไม่ใช่ spot elevation',[],49),
      c('stairs-landing','ชานพักบน/ล่าง','ชานพักกำกับช่วง 2.00 ม. ตามแปลนและรูปตัด',[],49),
      c('bst','คาน BST','หน้าตัด 0.30×0.50 ม.; แบบขยาย BST',[],49),c('column-c1','เสา C1','หน้าตัด 0.30×0.30 ม.; แบบขยาย C1',[],49),
      c('pile-c','เสาเข็ม C','0.30×0.40 ม. ยาว 10.00 ม. ตามแบบขยาย PDF หน้า 56; หัว/ปลายเข็ม [ต้องกรอก]',[],56),
      c('railing','ราวกันตกบันได','แสดงราวตามแนวลาดและชานพัก; เว้นช่องทางลง',[],49),
      c('stair-steel','เหล็กเสริมบันได / ชานพัก','ดูตำแหน่ง DB12 @0.15 ม. และ Ø9 @0.20 ม. ในรูปตัด A–A; ไม่แทนเหล็กทั้งบันไดด้วย spec เดียว',[],49),
      c('riprap-transition','ปรับลาดหินข้างบันได','กำกับปรับระดับลาด 1:5 ตามแปลนรายละเอียดด้านล่าง',[],49),
    ],['บันไดและชานพักแสดงแปลน/รูปตัด A–A และ B–B ครบ','ลูกตั้ง/ลูกนอนเป็น dimension จากแบบ ห้ามใช้อนุมาน elevation ชานพัก']);
    for(const [type,page,length] of [[1,57,6],[2,58,5],[3,59,7]]){
      const items=[...anchors(),c('drain-pipe',`ท่อระบายน้ำแบบ ${type}`,`ท่อ ค.ส.ล. Ø1.00 ม. ยาว ${length.toFixed(2)} ม.; รูปตัดท่อมาตรฐานชั้น 3 ตามหน้าแบบ`,[],page),
        c('pipe-bedding','คอนกรีตหยาบรองท่อ','กำกับส่วนผสม 1:3:5; ระดับผิวรองท่อ [ต้องกรอก]',[],page),
        c('sand','ทรายถมชุ่มน้ำอัดแน่น','วัสดุใต้/หลังทางระบายน้ำตาม leader line',[],page),
        c('pile-a','เสาเข็ม A','ยาว 12.00 ม.; ตำแหน่ง @1.00 ม. ตาม typical/รูปตัด',[],48),
        c('pile-b','เสาเข็ม B','ยาว 12.00 ม.; ตำแหน่ง @1.00 ม. ตาม typical/รูปตัด',[],48),
        c('s0','S0 บริเวณปากระบาย','ชิ้นส่วนรอบปากท่อ; ขนาด/รายละเอียดสัมพันธ์กับแบบขยาย',[],page)];
      if(type===1)items.push(c('drain-chamber','บ่อพักท่อระบาย','บ่อพักหลังเขื่อนดูแบบมาตรฐาน / PDF หน้า 61',[],page));
      if(type===2)items.push(c('headwall','ปากท่อ / headwall','แบบแปลน รูปด้าน ข–ข และรูปตัด ก–ก; ไม่อ่านระดับจาก slope',[],page),c('pipe-mouth-level','ระดับกำกับบริเวณปากท่อ','ค่าตาม leader ในรูปตัด — ไม่สมมุติเป็นท้องท่อทั้งแนว',[['ระดับกำกับปากท่อ',98.2]],page),c('earth-fill','ดินถม','กำกับถมดินหนา 0.30 ม.',[],page),c('headwall-steel','เหล็กปากท่อ','ดูแปลน/รูปตัดของแบบที่ 2; ไม่ใช้เหล็ก annotation เป็น revision',[],page));
      if(type===3)items.push(c('headwall','ช่องรับน้ำ / ปีกช่องรับน้ำ','แบบ 3 มีช่องรับน้ำปีกบานด้านหลังเขื่อนและท่อออกหน้าสองแนวตามแปลน',[],page),c('catchment-floor','พื้นช่องรับน้ำ','จุดระดับที่ระบุในรูปตัด A–A',[['ระดับพื้นช่องรับน้ำ',98.1]],page),c('pipe-mouth-level','จุดระดับกำกับบริเวณ S0','ค่ากำกับในรูปตัด A–A; ไม่อ้างเป็นท้องท่อ',[['ระดับกำกับบริเวณ S0',98.65]],page),c('earth-fill','ดินถม','กำกับถมดินหนา 0.30 ม.',[],page),c('headwall-steel','เหล็กช่องรับน้ำ / ปีก','ดู callout เหล็กจากแบบพิมพ์ในหน้า 59; สีและลายมือไม่นับเป็น spec ใหม่',[],page));
      add(`drain-${type}`,`ทางระบายน้ำหลังเขื่อนออกหน้า · แบบที่ ${type}`,page,`drain-${type}`,items,[`ท่อ Ø1.00 ม. ยาว ${length.toFixed(2)} ม. ตามแบบที่ ${type}`]);
    }
    add('cap','คาน GB1 / GB2 · ปิดหัวท้ายเขื่อน',54,'cap',[
      ...anchors(),c('gb2','คาน GB2','หน้าตัด 0.80×0.50 ม. ตามแบบขยาย',[],54),c('footpath','พื้นทางเท้า','พื้นหลังสันเขื่อนตามรูปตัด ก–ก / ข–ข',[],54),
      c('panel','แผงกรุ ค.ส.ล.','กว้าง 0.67 ม.; กำกับมิติสูง 1.00 ม. และหนา 0.12 ม. ดูขยายแผง; รุ่นมีช่องท่อแยกในหน้าเดียวกัน',[],54),
      c('gb1-steel','เหล็กคาน GB1','12 DB20; DB16 @0.15 ม. ด้านบน และ DB12 @0.15 ม. ด้านล่างตามขยาย GB1',[],54),
      c('panel-steel','เหล็กแผงกรุ','5Ø6 (2 ชั้น) และ 6Ø9 (2 ชั้น) ตามแผงชนิดไม่มีช่อง; แผงมีช่องดูแบบแยก',[],54),
      c('weep-hole','ช่องระบายน้ำแผงกรุ','แผงชนิดช่อง PVC; เส้นผ่านศูนย์กลางอ่านไม่ชัด [ต้องกรอก] จากต้นฉบับ CAD/แบบขยาย',[],54),
      c('geotextile','แผ่นใยสังเคราะห์','ติดหลังแผง; ข้อกำหนดวัสดุ PDF หน้า 64',[],54),c('railing','ราวกันตก','ตามแบบขยายหน้า 65',[],65),
      c('pile-a','เสาเข็ม A','0.30×0.50×12.00 ม. @1.00 ม.',[],55),c('pile-b','เสาเข็ม B','0.30×0.40×12.00 ม. @1.00 ม.',[],55),
      c('drain-gutter','ราง ค.ส.ล.','รางและบ่อพักหลังเขื่อนในแปลนปิดหัวท้าย',[],54),c('drain-chamber','บ่อพักหลังเขื่อน','ตามตำแหน่งในแปลน ดูแบบขยาย',[],54),
    ],['GB1 กว้าง 2.50 ม. หนา 0.50 ม.; GB2 กว้าง 0.80 ม. หนา 0.50 ม.']);
    for(const [type,page,width,length,strands] of [['a',55,'0.30×0.50',12,7],['b',55,'0.30×0.40',12,4],['c',56,'0.30×0.40',10,4]])add(`pile-${type}`,`แบบขยายเสาเข็ม ${type.toUpperCase()}`,page,'pile-detail',[
      c(`pile-${type}`,`เสาเข็ม ${type.toUpperCase()}`,`${width} ม. ยาว ${length.toFixed(2)} ม.; หัว/ปลาย elevation [ต้องกรอก]`,[],page),
      c('pc-strand','PC Strand',`${strands} เส้น Ø9.5 มม. ตามรูปขยาย`,[],page),c('dowel','Dowel เหล็ก','A: 4–Ø25; B/C: 3–Ø25 ยาวท่อนละ 3.30 ม. ตามรูปขยาย',[],page),
      c('pile-ties','เหล็กปลอก CDR',`CDR4.6 มม.; spacing เปลี่ยนตามช่วง ${type==='c'?'0.05 / 0.10 / 0.15':'0.05 / 0.10 / 0.15 / 0.175'} ม. ดูรูปขยาย ไม่แทนด้วยระยะเดียว`,[],page),
      c('lifting-point','จุดยกเสาเข็ม','A/B กำกับระยะจากปลาย 2.50 ม.; C กำกับ 2.10 ม.; ไม่ใช่ระดับหัวเข็ม',[],page),c('pile-tip','ปลายเสาเข็มเหล็กหล่อ','รูปขยายปลายเสาเข็ม; ไม่ใช้ความยาวอนุมาน elevation ปลาย',[],page),
    ],[`${width} ม. × ${length.toFixed(2)} ม. — schematic เหล็กและมิติ ไม่ใช่แกนระดับน้ำ`]);
    add('pipe-front','ผนัง W1 / พื้น SD / คาน GB1A บริเวณท่อ',60,'pipe-front',[
      c('crest','คาน GB1','คาน CAP กว้าง 2.50 ม.; ระดับอ้างอิงหน้าทั่วไป',[['สันเขื่อน',100.5,'crest']],48),
      c('wall-w1','ผนัง W1','คอนกรีตผนังบริเวณช่องท่อ; รายละเอียด RB9 @0.15 ม. each face ตามรูปด้าน',[],60),
      c('slab-sd','พื้น SD','กว้าง 1.00 ม. ยาว 1.50 ม. หนา 0.10 ม.; RB6 @0.20 ม.',[],60),
      c('gb1a','คาน GB1A','คานรองช่องระบายตามรูปตัด A–A; ระดับผิว [ต้องกรอก]',[],60),
      c('drain-pipe','ท่อระบายน้ำ','ช่องท่อขนาด 0.60–1.00 ม.; แบบเดี่ยว/คู่ในรูปด้าน ต้องเลือกตามตำแหน่งงาน',[],60),
      c('pipe-collar','คอนกรีตรอบท่อ','ดูวงแหวน/ขอบช่องท่อ W1 ตามรูปขยาย',[],60),c('pipe-bedding','คอนกรีตหยาบรองท่อ','ดูแนวรองในรูปตัด',[],60),c('pile-a','เสาเข็ม A','ตามรูปตัด',[],60),c('pile-b','เสาเข็ม B','ตามรูปตัด',[],60),c('panel','แผงกรุ','แนวแผงข้างช่องท่อ',[],60),
    ]);
    add('manhole','บ่อพัก ค.ส.ล. · E–E / D–D / F–F',61,'manhole',[
      c('drain-chamber','ตัวบ่อพัก','ขนาดตามประเภท MH1–MH5 และเส้นผ่านศูนย์กลางท่อ ไม่เลือกขนาดแทนโดยไม่มีตำแหน่ง',[],61),c('chamber-base','พื้นบ่อพัก','DB12 @0.15 ม. ตามรูปตัด; ระดับพื้น [ต้องกรอก]',[],61),
      c('chamber-cover','ฝาบ่อพัก','ค.ส.ล. หนา 0.15 ม.; ฝามีหลายรูปแบบ ดู G–G',[],61),c('cover-frame','กรอบฝา / anchor bar','L50×50×6 มม. ตามรายละเอียด',[],61),
      c('ladder-rungs','บันไดเหล็กอาบสังกะสี','กำกับช่วงตั้ง 0.30 ม. ตามรูปขยาย',[],61),c('drain-pipe','ท่อเข้า/ออก','ขนาดสัมพันธ์กับ MH ตามตาราง; invert [ต้องกรอก]',[],61),c('chamber-steel','เหล็กผนังและรอบช่องท่อ','DB12 @0.15 ม. และเหล็กเสริมรอบช่องตามรูปขยาย',[],61),c('pipe-bedding','คอนกรีตหยาบ / ทรายใต้บ่อ','ตามรูปตัด ไม่ใช่ระดับอ้างอิงน้ำ',[],61),
    ],['MH1–MH5 มีขนาดต่างกัน ต้องอ้างตำแหน่งแปลนก่อนระบุชนิดที่ติดตั้ง']);
    add('railing','ราวกันตก · A–A / B–B / C–C',65,'railing-detail',[
      c('railing','เสาราวกันตก','เหล็กกล่องชุบสังกะสี 75×75 มม. หนา 3.2 มม.; ระยะช่องตามรูปด้าน 1.50 ม.',[],65),
      c('rail-horizontal','ท่อราวแนวนอน','เหล็กกล่องชุบสังกะสี 50×50 มม. หนา 2.3 มม.',[],65),c('rail-baseplate','แผ่นฐานเสาราว','0.15×0.15 ม. หนา 6 มม.',[],65),c('rail-anchor','นอตยึดราว','Ø12 มม. ยาว 25 ซม.; ฝังไม่น้อยกว่า 15 ซม. ตามหมายเหตุ',[],65),
      c('rail-galvanizing','ผิวชุบสังกะสี','hot dip galvanizing ตามข้อกำหนดในแบบ; ไม่ใช้สี annotation เปลี่ยน spec',[],65),c('rail-footing','คอนกรีตฐานราว / คาน','ฐานและเหล็กตามรูปตัด C–C; elevation ขอบราว [ต้องกรอก]',[],65),
    ],['ราวสูงตามมิติ 0.96 ม. จากผิวทางเท้า เป็นมิติสัมพัทธ์ ไม่ใช่ระดับ ม.รทก.']);
    add('small-drain','ราง / บ่อพักราง / ตะแกรง / S0',66,'small-drain',[
      c('drain-gutter','ราง ค.ส.ล.','รายละเอียดรางหน้ากว้างกำกับ 0.30 ม.; เหล็ก/มิติตามรูปขยาย',[],66),c('drain-chamber','บ่อพักราง','รูปตัด 1–1 และ 2–2; ระดับท้องราง [ต้องกรอก]',[],66),
      c('drain-pipe','ท่อ PVC','ชั้น 8.5 ขนาด Ø200 มม.; ทางออกตามแนวแผง',[],66),c('chamber-cover','ฝาบ่อพักราง','ฝาปิดและเหล็กตามรูปขยาย; ไม่ใช้ระดับสันเขื่อนเป็นระดับฝาโดยอัตโนมัติ',[],66),
      c('grating','ตะแกรงเหล็กกันขยะ','เหล็กตามรายละเอียดตะแกรง; ดึงออกดูแลรักษาได้ตามแบบ',[],66),c('s0','S0','ขนาด 1.00×1.00×0.10 ม.; Ø6 @0.20 ม. ตามแบบขยาย',[],66),c('pipe-bedding','คอนกรีตหยาบรองราง','หนา 0.10 ม. ตามรูปตัด',[],66),c('geotextile','ใยสังเคราะห์','แนวหลังแผง/ใต้หินตาม leader line',[],66),
    ]);
    // Each surveyed cross-section remains selectable. Never fabricate its surveyed
    // ground profile or copy the typical's spot levels as if measured on that page.
    for(let n=1;n<=76;n++){
      const page=10+Math.floor((n-1)/2);
      const components=base.components.map(item=>({...item,source:base.source,reference:'component/ระดับอ้างอิงจากรูปตัดทั่วไป PDF หน้า 48; ไม่ใช่ระดับดินสำรวจของรูปตัดนี้'}));
      add(`profile-${n}`,`รูปตัดตามแนว ${n}`,page,'profile',components,base.dimensions);
      Object.assign(result[result.length-1],{profileNumber:n,profileGroundStatus:'[ต้องกรอก] ยังไม่ถอดค่าดินสำรวจทุกจุดจากตาราง; ภาพใช้ topology ของ typical ไม่ใช่เส้น ground survey',notes:['รูปตัดตามแนวมีในต้นฉบับหน้าอ้างอิง; component และระดับในภาพนี้อ้าง typical แผ่น 47','แนวดินสำรวจเฉพาะตำแหน่งยังไม่ได้ digitize จึงแสดง schematic และไม่อ้างว่าเป็น as-built','ไม่มี MSL tie: ค่าน้ำ station แยกสเกลจากระดับแบบ']});
    }
    return result;
  }
  const api={sections}; if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SamcoBuengkanDetails=api;
})(typeof window==='undefined'?globalThis:window);
