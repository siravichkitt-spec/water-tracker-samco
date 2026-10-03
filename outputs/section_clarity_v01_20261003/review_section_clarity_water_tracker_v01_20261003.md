# Section drawing clarity — SAMCO LOGISTICS (ก)

Release: water-tracker-v4.2-20261003 · วันที่ตรวจ 2026-10-03

## งานที่แก้

- วาด SVG ใหม่ตาม view ในแบบ ไม่ใช้ภาพ PDF แปะใน animation
- แยก callout ชื่อ/หมายเลขออกจาก geometry; เส้นชี้แสดงเฉพาะ item ที่เลือก เพื่อลดเส้นตัดกัน
- ย้าย spot elevation และรายละเอียดไปพื้นที่อ่านแยก พร้อม component picker และภาพ vector ขยาย
- เพิ่ม compact overview สำหรับหน้าจอแคบ โดยไม่บังคับเลื่อนภาพแนวนอนในหน้าหลัก
- รักษาภาพ detail หลาย view ของบึงกาฬ: บันได, GB1/GB2, เสาเข็ม A/B/C, ระบบท่อ, MH, ราวกันตก และรางระบายน้ำ
- แก้ S0 +98.65 ของ drain type 3 ให้ชี้ด้านแม่น้ำตาม PDF หน้า 59 ไม่ใช่ headwall ด้าน inlet
- แก้ async race: request ของโครงการเก่าห้ามขึ้น ERROR ทับโครงการใหม่หลังสลับหน้า

## ผลตรวจ

| การตรวจ | ผล |
|---|---|
| Node tests: `node --test typical-sections.test.js section-animation.test.js` | 23/23 ผ่าน |
| Public SELECT: `node scripts/verify_typical_database.js` | registry ใน SAMCO Supabase ตรงทั้ง 5 โครงการ |
| Registry/source catalog | 94 entries: 18 section/detail entries และ 76 profile-reference entries; ไม่ใช่ 94 รูปตัดอิสระ |
| Component/spot occurrences ใน registry รวมรายการอ้างอิงซ้ำ | 1,265 / 184 |
| Bounding boxes ของ external callout | ไม่ทับกัน/ไม่เข้า geometry field ใน tests ทุก entry |
| Browser desktop | 1440×1000; บึงกาฬทุก 13 scene ไม่มี callout ถูกตัดขอบ |
| Browser mobile portrait | 375×900; ไม่มี page overflow แนวนอน |
| Browser landscape / reduced motion | 812×375; compact overview, ไม่มี overflow, transition 0s เมื่อ reduced motion |
| Rapid site switch | สลับ 5 ครั้งตาม UI; ไม่มี browser error ใหม่ และปลายทางแสดง station TKS.121 ถูกโครงการ |
| Zoom + live rerender | ความกว้าง 1750px คงเดิม, ไม่มี duplicate SVG IDs, selected component คงอยู่ |
| Source PDFs | byte-identical กับ SHA manifest; ไม่แก้ต้นฉบับ |

## Source และขอบเขตความถูกต้อง

ใช้ `typical-sections.js`, source PDFs ใน `assets/typical/` และระดับที่ถอดไว้แล้วใน registry ไม่เปลี่ยน station, datum offset, ingestion, RLS หรือค่าในฐานข้อมูล

บึงกาฬ PDF หน้า 48 typical, 49 บันได, 54 GB1/GB2, 55–56 เข็ม, 57–59 drainage types, 60 W1/SD/GB1A, 61 MH, 65 railing, 66 small drain. หมายเลข PDF รวม cover ไม่เท่าหมายเลขแผ่นพิมพ์ จึงแสดงทั้งสองค่าใน app

Geometry เป็น schematic ตาม source view ไม่ใช่ as-built: ระดับ spot ที่ระบุใช้ค่าตามแบบ แต่ pixel widths/ตำแหน่ง annotation ไม่ใช่มิติก่อสร้าง. Break line ย่อความยาวเข็ม ไม่อนุมาน toe elevation จากความยาวเข็ม. รายการไม่มีระดับแสดง `[ต้องกรอก]` พร้อม source ที่ต้องตรวจเพิ่ม. Profile-reference 76 entries ยังไม่ digitize เส้นดินแต่ละ profile จึงยังไม่อ้างว่า geometry profile ครบ

บึงกาฬเป็น local datum จึงแสดงค่าจริง station MSL แยกสเกล ไม่ซ้อนน้ำ MSL บนระดับสมมุติ 100.xx และไม่คำนวณ freeboard ข้าม datum. ภาพ detail ที่ไม่มีแกน datum ร่วมก็แสดงน้ำแยกจาก geometry

## Freshness ที่ตรวจจากข้อมูลจริง

ตรวจวันที่ 2026-10-03: บึงกาฬ TKS.121 มีข้อมูลล่าสุด 2026-09-14 09:00 เวลาไทย; ปราจีน Kgt.3 ล่าสุด 2026-09-27 09:00 เวลาไทย. ทั้งสองแสดง STALE — งานภาพนี้ไม่ได้แก้ให้ upstream กลับมาส่งข้อมูลสด. ไม่อ้างว่า app real-time 100% ทุก station

## ขั้นตอนทวนหลัง release

Reload app แล้วเลือกบึงกาฬ → drainage type 3 → เลือก S0 และกดขยายภาพ. ตรวจ label +98.65 ด้าน outlet และทวนชื่อ/รายละเอียดทุก component ในตารางด้านล่าง. ต้องใช้ BM tie ที่ยืนยัน local datum → MSL ก่อนอนุญาต overlay น้ำบนรูปตัดบึงกาฬ
