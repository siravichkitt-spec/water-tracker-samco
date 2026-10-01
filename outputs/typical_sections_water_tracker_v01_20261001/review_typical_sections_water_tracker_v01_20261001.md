# Typical sections — รายงานตรวจแบบและ implementation

วันที่: 2026-10-01 · SAMCO LOGISTICS · (ก)

## ผลงาน

นำเข้า PDF ที่เจ้าของงานเคาะเป็นแบบหลัก 5 ไฟล์ 6 หน้า เป็น 6 section รวม 93 component record และ 18 spot elevation ที่ระบุในแบบ เก็บภาพ/ไฟล์ต้นฉบับพร้อม SHA256; ไม่ใช้รูปตัด hardcode ชุดเดียวทุกงานอีกต่อไป

- ท่าจีน: 2 section, 26 component record, 7 spot elevation รวมทั้งสองชุด
- น่าน: 1 section, 24 component record, 4 spot elevation; มีรูปตัดและแปลน D พร้อมความยาว 8.00 ม. สำหรับ กม. 0+000–0+080 และ 9.00 ม. สำหรับ กม. 0+081–0+700 ตามตารางในแผ่น 23
- อ่างทอง: 1 section, 15 component record, 3 spot elevation
- ปราจีนบุรี: 1 section, 14 component record, 2 spot elevation; เจ้าของงานยืนยันว่าเป็น site เดิม ไม่สร้าง site ซ้ำ
- บึงกาฬแม่น้ำฮี้: 1 section, 14 component record, 2 spot elevation; คง local datum และห้ามคำนวณระยะเทียบ station MSL

จำนวน component เป็นการนับรายการใน registry (แยกวัสดุ/งานระบายน้ำ/แถวเสาเข็ม/แนวดิน/รายละเอียดที่อ้างตาม typical) ไม่ใช่จำนวนชิ้นงานหรือ BOQ quantity

## ระดับที่แก้และการแยก section

- อ่างทอง แผ่น 17: สันเขื่อน +99.000 แทน +96.500; สันหินเรียง +97.000 แทน +95.500; เพิ่มสันหินทิ้ง +92.600
- ท่าจีน แผ่น 14: สันเขื่อน +100.000; สันหินทิ้ง +98.000; หัวเสาเข็มเสริมกำลังดิน +97.000/+96.000/+95.000
- ท่าจีน แผ่น 15: สันเขื่อน +99.200; สันหินทิ้ง +97.200; ไม่ยกหัวเสาเข็มสามระดับจากช่วงที่ 1 มาใช้กับช่วงที่ 2
- น่าน แผ่น 23: +98.000 คือสันหินเรียง; +91.500 คือสันหินทิ้ง แก้ label ที่เดิมสลับกัน
- ปราจีนบุรี แผ่น 39: +97.500 คือสันหินทิ้ง ไม่ใช่หินเรียง; @1.00 ม. คือ spacing เสาเข็ม ไม่ใช่ cut-off +1.00
- แก้สถานที่ปราจีนบุรีตาม title block เป็น ต.หาดนางแก้ว อ.กบินทร์บุรี และอ้างเลขแบบ 68-PR03-SD-01; ไม่เติมชื่อบ้านที่ยังไม่ชัด และไม่เปลี่ยนพิกัด/gauge/datum โดยไม่มีเอกสารใหม่
- ค่า +93.869 ของอ่างทองมี label น้ำสูงสุดเฉลี่ยซ้ำใน PDF; app แสดงหมายเหตุความขัดแย้ง ไม่แก้คำในต้นฉบับเอง

Critical threshold ผูกกับสันเขื่อนต่ำสุดในทุก section ที่แนบ: ท่าจีน 99.200 และอ่างทอง 99.000; warning threshold เชิง operation เดิมคงเดิม ไม่แต่งเกณฑ์ใหม่จาก spec วัสดุ บึงกาฬยังใช้ threshold ของ station MSL 187 ตามระบบเดิม ไม่แปลงเป็น local datum

## ขอบเขต verification

- ตรวจภาพทุกหน้าและ spot elevation/leader line ซ้ำ; test expected levels ถอดแยกจาก registry
- ทุก component มีชื่อ/detail/source file/page/sheet; มีระดับชัดหรือมีเหตุผลที่ระดับเป็น [ต้องกรอก]
- ทดสอบ 11 automated checks: จำนวน/ระดับ/variants/source hashes/unknown levels/datum isolation/source escaping/frontend syntax/fallback/seed synchronization
- ทดสอบ browser ทุก site: จำนวน component และระดับตรง registry; เลือกท่าจีนช่วงที่ 2 แล้ว KPI/กราฟใช้ +99.200/+97.200; ไม่ซ่อนช่วงที่ 1
- ภาพแบบขยายโหลดได้; desktop และมือถือ 390 px ไม่มี page overflow; ตารางเลื่อนได้ภายใน container
- กัน chart request ที่คืนช้าหลังสลับ site/range ไม่ให้ใช้ข้อมูลโครงการก่อนหน้ากับ datum/section ปัจจุบัน
- แบบ/component ยังแสดงได้เมื่อ telemetry ไม่มีข้อมูลหรือโหลดล้มเหลว
- Supabase เป้าหมาย: `samco-logistics` ref `yiyoagypmcnatdauuadf` เท่านั้น ไม่แก้ `samakee`; migration เพิ่ม JSONB และแก้เฉพาะ tracker design metadata ไม่แก้ readings ประวัติ
- public `anon`/`authenticated` ยังคง SELECT เท่านั้น และ table ยังคง RLS enabled

## ข้อมูลที่ยังไม่มีในไฟล์แนบ

ไม่ได้อ้างว่าตรวจรายละเอียดเหล็ก/แบบขยายครบ: typical หลายรายการระบุ “ดูแบบขยาย/ตามแบบมาตรฐาน” แต่ไม่ได้ส่งแผ่นนั้นมา ระดับหัว/ปลาย A/B, ขอบแผงกรุ, ท้องท่อ, ราวกันตก และหลายองค์ประกอบไม่ได้ระบุ spot elevation ชัดใน typical จะเห็น [ต้องกรอก] พร้อม reference ที่ต้องขอเพิ่ม

การแสดงทุก component ไม่ได้แปลว่าทุก component มี elevation ที่วัดได้จากหน้านี้ ห้ามสร้างระดับจาก pixel หรือเอาความยาวเสาเข็มลบจากสันเขื่อนโดยสมมุติจุดหัวเข็ม ห้าม overlay น้ำ station ลง raster แบบโดยคาดเดาตำแหน่งแนวดิ่ง

Station reading ไม่ใช่ sensor ที่หน้างาน แม้ datum offset ใช้ร่วมกันได้ก็เป็น derived site scale เท่านั้น บึงกาฬต้องมี BM/site calibration ที่ผูกกับ MSL ก่อนเปิดการเทียบระดับ

## หลักฐานและ recovery

- `assets/typical/source_manifest.json`: ต้นฉบับและ SHA256 ทุก PDF
- `sites/typical-sections.json`: inventory/source ทุก section และ component
- `typical-sections.js`: source registry ที่ใช้ใน fallback และ generator
- `typical-sections.test.js`: automated checks; รัน `node --test typical-sections.test.js`
- `scripts/verify_typical_database.js`: public read-only verification เทียบทุก field กับ seed
- `sites_before.json`: metadata ก่อน release นี้
- `rollback_design_metadata.sql`: rollback เฉพาะค่าที่แก้ ไม่ลบ telemetry หรือ schema
- `supabase/migrations/20261001144431_typical_sections.sql`: migration ที่ apply บน SAMCO LOGISTICS
- screenshots ใน `output/playwright/typical_*_20261001.png`

Skill ที่ใช้: pdf, supabase, playwright, vercel-deploy

อ้างอิงเทคนิคที่ตรวจ ณ 2026-10-01: [Supabase JSONB](https://supabase.com/docs/guides/database/json), [Supabase changelog](https://supabase.com/changelog), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Security advisors ก่อน migration มี warning เดิมนอกขอบเขตงาน ได้แก่ pg_net ใน public และ leaked-password protection disabled; ไม่เปลี่ยนระบบอื่นเพื่อแก้ warning ในงานนี้ ดู [extension remediation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) และ [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Next step

เพิ่มแบบขยาย/แบบมาตรฐานที่ callout อ้าง และ plan ระบุช่วง กม. ของแต่ละ section เพื่อเติมระดับ/spec ที่ยังไม่มีหลักฐาน แล้วให้ทีมหน้างานยืนยัน BM calibration ของแม่น้ำฮี้ก่อนใช้ระดับน้ำตัดสินใจเชิงตัวเลข
