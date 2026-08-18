# Water Tracker QA Record

**Bottom line:** Code, Supabase production, Vercel deployment and browser end-to-end checks passed. No blocking defects remain for public read-only release water-tracker-v3-20260818.

- Entity: **SAMCO LOGISTICS**
- Authority: **(ก) แพนสั่งได้เอง**
- Production: https://samco-water-tracker.vercel.app
- Application commit: ef8b77a
- QA date: 2026-08-18

## 1. Static and runtime checks

| Check | Result | Evidence date |
|---|---|---|
| Deno type-check: water-tracker-poll | PASS | 2026-08-18 |
| Deno type-check: water-tracker-backfill | PASS | 2026-08-18 |
| Browser inline JavaScript syntax | PASS | 2026-08-18 |
| Git whitespace/error scan | PASS | 2026-08-18 |
| Edge Function poll version | 3 / ACTIVE | 2026-08-18 |
| Edge Function backfill version | 3 / ACTIVE | 2026-08-18 |
| Supabase migration applied | PASS | 2026-08-18 |

Pinned runtime dependencies:

- @supabase/supabase-js@2.112.3
- Deno type-check runtime 2.9.5

## 2. Supabase integration

| Check | Expected | Actual | Result |
|---|---:|---:|---|
| Active sites processed | 5 | 5 | PASS |
| Skipped sites | 0 | 0 | PASS |
| Poll errors | 0 | 0 | PASS |
| Water tables with RLS | 4 | 4 | PASS |
| Water tables in Realtime publication | 4 | 4 | PASS |
| Public read | 200 | 200 | PASS |
| Public write | denied | 401 | PASS |
| Poll without secret | denied | 401 | PASS |
| Backfill without secret | denied | 401 | PASS |

Authorized poll run id 1 completed at 2026-08-18 14:15:06 ICT; scheduled poll run id 2 completed at 2026-08-18 14:30:03 ICT. Both processed all five sites with zero skipped sites and no error message.

## 3. Local browser QA

Playwright checked the completed build against production Supabase before GitHub merge.

| View | Result |
|---|---|
| Desktop 1440 × 1000 | PASS |
| Mobile 390 × 844 | PASS |
| Browser console errors | 0 |
| Browser console warnings | 0 |
| Horizontal page overflow on mobile | 0 px |
| Five site selectors | PASS |
| บึงกาฬ design-scale button disabled | PASS |
| Realtime connected state | PASS |

## 4. Vercel post-deploy QA

Production HTTP check at 2026-08-18 14:29:36 ICT:

- HTTP status: 200
- Title: Water Level Tracker — SAMCO
- Release marker: water-tracker-v3-20260818
- Vercel region response: sin1

Playwright then opened the canonical production domain and exercised all five site selectors:

| Site | Freshness shown during QA | Data/render errors | Datum gate |
|---|---|---:|---|
| นครชัยศรี (ท่าจีน) | LIVE | 0 | design comparison allowed |
| โคกสลุด (น่าน) | LIVE | 0 | design comparison allowed |
| อ่างทอง (คลองบางแก้ว) | DELAYED | 0 | design comparison allowed |
| ปราจีนบุรี | LIVE | 0 | design comparison allowed |
| บึงกาฬ (แม่น้ำฮี้) | LIVE | 0 | design comparison blocked |

During this production session, the connection text changed from ingestion RUNNING to ingestion SUCCESS while cron run id 2 completed. This confirms the deployed Realtime subscription received live ingestion state rather than relying only on page reload.

Final production browser checks:

- Desktop: PASS
- Mobile 390 × 844: PASS
- Mobile document width: 390 px
- Mobile scroll width: 390 px
- Console errors: 0
- Console warnings: 0
- Page-level data error components: 0

## 5. Known non-blocking conditions

1. ThaiWater is an external dependency. Its delay/outage cannot be converted into a truthful 100% availability guarantee.
2. Station telemetry is not an on-site sensor. The UI now states this explicitly.
3. บึงกาฬ uses local datum; cross-datum design comparison remains blocked until a verified transformation is supplied.
4. Two Vercel projects are connected to the repository. Both deployed successfully, but samco-water-tracker.vercel.app is the canonical production domain.

## 6. QA decision

**PASS — ready for SAMCO LOGISTICS public read-only use.**
