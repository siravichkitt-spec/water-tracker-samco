# Water Tracker (SAMCO)

Real-time water level monitoring for SAMCO project sites.

- Frontend: Static HTML/CSS/JS
- Backend: Supabase (samco-logistics project) — sites config + readings log + alerts
- Data poll: pg_cron every 15 min → Supabase Edge Function `water-tracker-poll` → ThaiWater API
- Deploy: Vercel (via GitHub auto-deploy)

## Sites
1. thachin-nakhonchaisi (Tha Chin)
2. khoksalut-nan (Nan)
3. angthong-bangkaew (Chao Phraya)
4. prachinburi (Prachinburi)
5. buengkan-nam-hi (Nam Hi — local datum)
