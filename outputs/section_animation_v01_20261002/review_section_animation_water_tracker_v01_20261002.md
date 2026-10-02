# Vector section animation — implementation and verification

วันที่ 2026-10-02 · SAMCO LOGISTICS · (ก)

## ผลงาน

- คืนหน้าตัดเป็น vector SVG พร้อมข้อมูลน้ำในภาพ ไม่เอาภาพ PDF มาเป็นรูปหลัก
- ทุก component ใน registry มีหมายเลขในภาพ รายการชื่อ กด highlight และดู detail/ระดับ/ที่มาได้
- ทุก section เข้าถึงได้จาก dropdown และแผงพับ; ท่าจีนทั้งสอง section และ variant เข็มน่านยังอยู่ครบ
- น้ำ overlay ใช้ reading จริงใน Supabase หลังแปลง datum ที่ใช้ร่วมกันได้ แสดงค่าและเวลา ไม่สุ่มตัวเลข คลื่นเคลื่อนไหวเฉพาะ LIVE และรองรับ reduced motion
- เมื่อ reading เปลี่ยน เส้นน้ำเคลื่อนจากค่าจริงก่อนหน้าไปค่าจริงใหม่ ส่วนตัวเลขแสดงค่าจริงทันที ไม่สร้างค่าทางวิศวกรรมระหว่าง interpolation
- Mobile ใช้ภาพเลื่อนแนวนอนพร้อมคำแนะนำ และมีค่าน้ำที่หัวภาพ รายการ detail อ่านได้แยกจากภาพ
- บึงกาฬใช้ชุด A_01-05.pdf: เพิ่มบันได ทางระบายน้ำแบบ 1/2/3 คาน GB1/GB2/GB1A, แผงกรุ, เสาเข็ม A/B/C และองค์ประกอบเหล็ก, ผนัง W1/พื้น SD, บ่อพัก/ฝา/กรอบ/บันได, ราว/ฐาน/นอต, ราง/PVC/ตะแกรง/S0
- แก้เลขแผ่น typical บึงกาฬเป็น 47/65 (PDF หน้า 48) และลบข้อความประมาณ offset ที่ไม่มีหลักฐานออกจากคำเตือน

## ขอบเขตที่ห้ามเข้าใจเกินจริง

- ภาพ component เป็น schematic; เฉพาะ spot elevation และเส้นน้ำใน datum ที่เทียบกันได้ใช้แกนระดับจริง ภาพไม่ใช่ as-built ไม่ใช้วัดมิติจาก pixel
- ข้อมูลบาง item ในหน้าขยายยังไม่ชัด/ไม่มี absolute elevation แสดง [ต้องกรอก] ไม่อ้างว่าตรวจทุก spec/เหล็กครบทั้ง 66 หน้า
- รายการมี 18 typical/detail sections และ 201 component occurrences ไม่ใช่จำนวนชิ้นงานก่อสร้างหรือ unique BOQ items
- รูปตัดตามแนวบึงกาฬ 1–76 เลือกได้พร้อม PDF page/sheet ของตัวเอง แต่ SVG ใช้ topology/ระดับ component จาก typical พร้อมป้ายว่าดินสำรวจรายจุดยังไม่ digitize ไม่อ้างเป็น ground profile จริง
- เมื่อนับ component/ระดับที่ซ้ำใน profile references ได้ 94 entries / 1265 component occurrences / 184 spot-level occurrences ตัวเลขนี้ตรวจด้วย script ซ้ำ ไม่ใช่จำนวน elevation ที่ไม่ซ้ำ
- บึงกาฬยังไม่มี BM-to-MSL tie ในหน้า BM ของแบบ จึงแสดงน้ำ station MSL ในกรอบแยกสเกลภายในภาพ ไม่มี overlay/freeboard ของโครงการ
- ข้อมูลน้ำบึงกาฬล่าสุดที่ตรวจจาก Supabase วันที่ 2026-10-02: measured_at 2026-09-14T02:00:00Z หรือ 09:00 ไทย, 182.840 ม.รทก., source thaiwater_v3, fetched_at 2026-09-14T03:00:04.945507Z ต้องแสดง STALE ไม่ใช่ LIVE; งาน animation นี้ไม่ได้แก้หรือเติม telemetry

## Verification

- Node tests: 18 ผ่าน / 0 ไม่ผ่าน ครอบคลุม marker ทุก component, source hashes, golden levels เดิม, ทุก drainage type/profile, datum isolation, no-data/wrong-site/nonfinite/stale, no PDF images, no random telemetry และ seed synchronization
- Public REST verification: เปรียบเทียบ section/detail/design levels/datum/station/coordinates/threshold ของทั้งห้าโครงการกับ registry ผ่านทั้งหมด
- ตรวจ pg_class และ grants: water_tracker_sites/readings/alerts/ingestion_runs เปิด RLS; anon และ authenticated SELECT ได้ แต่ INSERT/UPDATE/DELETE ไม่ได้ ไม่เปลี่ยน policy/grants
- Local browser: ตรวจทั้งห้าโครงการ, เปลี่ยนท่าจีน section 2 แล้วสันเขื่อนอ้าง +99.200, เลือกบึงกาฬ drain 3 และ profile 76, กด component inspector และคง highlight หลัง render ใหม่, Desktop/Mobile ไม่มี page-level horizontal overflow
- ทดสอบ transition ใน browser ด้วย reading สำเนาชั่วคราวใน memory แล้วคืนค่าเดิม ไม่เขียน reading ทดสอบเข้า Supabase; ตรวจว่ามี animation บน water layer
- พบ Realtime callback จากข้อมูลจริงใน local browser ระหว่างการตรวจ (console reason realtime) — ไม่รับรอง upstream วัดทุกวินาทีหรือส่งทุก message ได้ 100%
- Console ตรวจรอบก่อน release ไม่มี JavaScript error
- Release: water-tracker-v4.1-20261002; การ deploy ใช้ GitHub master → Vercel project samco-water-tracker ตาม workflow เดิม ตรวจสถานะ READY ผ่าน Vercel API แยกหลัง push

## Recovery และสิ่งที่ไม่เปลี่ยน

`rollback_metadata.sql` คืนเฉพาะ typical_sections/design_levels/คำเตือน datum ที่ snapshot ไว้ก่อนแก้ ไม่แตะ telemetry ส่วน `update_metadata.sql` คือ serialization ของ registry ที่ตรวจแล้ว Connector ไม่รับ payload ใหญ่ในครั้งเดียว จึง apply แบบแยก section และตรวจเทียบฐานข้อมูลหลังครบ ไม่มี schema migration ใน release นี้

ไม่ได้เปลี่ยน station IDs, coordinates, datum offsets, operational thresholds, readings, ingestion functions, scheduler หรือสิทธิ์ public read-only และไม่ได้แตะ Supabase ของบริษัทสามัคคี

Skill ที่มีผลต่อวิธีทำ: pdf ใช้ยืนยัน source/page/ระดับและแยก annotation ออกจากคำสั่ง; supabase ใช้ตรวจ metadata/Reatime/RLS; playwright ใช้ทดสอบ browser; vercel-deploy ใช้ปล่อยระบบเดิมโดยไม่สร้างโปรเจกต์ใหม่

Next step: ผู้สำรวจให้ค่า ม.รทก. ของ BM เดียวกับแบบเพื่อเปิด overlay บึงกาฬได้; การทำให้ข้อมูลบึงกาฬสดต้องตรวจ source/ingestion แยกจากงานภาพ โดยไม่แต่ง reading ทดแทน
