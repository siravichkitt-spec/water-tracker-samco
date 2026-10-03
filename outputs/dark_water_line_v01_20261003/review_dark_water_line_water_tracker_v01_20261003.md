# Dark section + water-line interaction — SAMCO LOGISTICS (ก)

Release `water-tracker-v4.3-20261003` · ตรวจ 2026-10-03

- เปลี่ยนพื้น SVG หลัก, compact overview, detail inset และ zoom viewport เป็น midnight blue; เปลี่ยนสีเส้น/text/hatch ให้เหมาะกับพื้นเข้ม ไม่ invert ภาพ PDF
- ชี้/แตะเส้นน้ำเปิด popover: ระดับสเกลแบบ, MSL, station, freshness, เวลาวัด/update ระดับ (`measuredAt`) และเวลาระบบรับ (`fetchedAt`) แยกกันในเวลาไทย
- Click/tap pin กล่อง; ปิดด้วย × หรือ Escape. Keyboard focus + Enter/Space ใช้ได้. พื้นที่รับ pointer ของเส้น 44 CSS px ผ่าน non-scaling stroke โดยเส้นจริงคงความหนาเดิม
- เมื่อ live render เปลี่ยน reading, payload บนเส้นถูกสร้างใหม่และกล่องที่เปิดค้าง refresh จาก payload ใหม่; ไม่มี Date.now แทนเวลาวัด และไม่มีการเขียน/สร้างข้อมูลน้ำใน DB
- Popover ใน zoom อยู่ใน dialog top layer, รองรับ rerender และเลือก component เดิม

## Verification

| Check | ผล |
|---|---|
| Node tests | 26/26 ผ่าน รวม dark surfaces ทุก registry entry, contrast ≥4.5:1 ของ text palette, metadata อัปเดตค่าและเวลาวัด, no line ข้าม datum |
| Public SELECT SAMCO Supabase | source registry ตรงทั้ง 5 โครงการ |
| Desktop 1440×1000 | Hover/click แสดงค่าจริง, pin คงอยู่หลัง `renderCrossSection()` |
| Mobile touch context 375×900 | `hasTouch:true`, tap เปิด popover, ไม่มี horizontal page overflow |
| Keyboard | Focus + Enter เปิด, Escape ปิด |
| Zoom | แสดง popover และอยู่ต่อหลัง refresh |
| Landscape 812×375 / reduced motion / text 200% | popover สูงไม่เกิน viewport-24px, scroll ภายในอ่านส่วนที่เกินได้, ไม่หลุดจอ |
| บึงกาฬ cap detail | ทั้ง 3 inset ใช้พื้นเข้ม; ไม่มี water overlay และ popover จากโครงการก่อนหน้าถูกปิด |
| Console หลัง QA | ไม่มี error |

Screenshots ใน `output/playwright/water_line_dark_desktop_v01_20261003.png` และ `water_line_dark_touch_v01_20261003.png`. Browser QA ใช้ local release code และ public Supabase readings จริง ไม่ใช่ screenshot production

## ข้อมูล/ขอบเขต

ไม่เปลี่ยน geometry, source levels, station, offset, ingestion, database, RLS หรือ datum policy. บึงกาฬยัง local datum ไม่มี BM tie → MSL จึงไม่สร้างเส้นน้ำข้ามสเกล. Detail views ที่ไม่มีแกนระดับร่วมยังแสดง reading แยก. Source PDFs และข้อจำกัด schematic/as-built ยังคงเดิม

Tooltip data source: `fetchLatestReadingFromDB` ใน `index.html` → `water_tracker_readings.measured_at / wl_msl / wl_design / fetched_at`; ไม่ใช้เวลาที่ reload หน้าเป็นเวลาวัด. หาก fetched_at ไม่ถูกส่งมา จะแสดงว่าไม่พบเวลารับ ไม่กรอกเวลาสมมุติ

Next step: Reload app แล้วชี้หรือแตะเส้นน้ำใน section ที่ datum ใช้ร่วมกันได้; กดขยายภาพหากต้องการตรวจ component พร้อม reading
