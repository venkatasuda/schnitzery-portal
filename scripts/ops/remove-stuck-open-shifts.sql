-- Remove clock-ins that were never clocked out ("working since 1065 hours").
-- Run in the Supabase SQL editor of the SCHNITZERY project (vxwtmtlkwvwcdegtcjuz), one step at a time.
-- A stuck session has status 'active' or 'on-break' and no clock-out. Removing it sets those hours to 0:
-- nothing was approved or paid from it. Completed shifts are not touched.

-- ── STEP 1: look first (changes nothing) ─────────────────────────────────────────────────────────────
-- Every session that has been open for more than 16 hours, for all staff.
select l.id, u.full_name, u.email, l.work_date, l.clock_in, l.status,
       round(extract(epoch from (now() - l.clock_in)) / 3600) as hours_open
from public.attendance_logs l
join public.users u on u.id = l.user_id
where l.status in ('active', 'on-break') and l.clock_out is null
  and l.clock_in < now() - interval '16 hours'
order by l.clock_in;

-- ── STEP 2: remove Achsah's stuck session(s) ─────────────────────────────────────────────────────────
-- Shows the removed rows. Expect 1 row. If it shows more than you saw in step 1 for her, run ROLLBACK instead of COMMIT.
begin;
delete from public.attendance_logs l
using public.users u
where u.id = l.user_id
  and u.email = 'achsah.kit-002@schnitzery-stuttgart.de'
  and l.status in ('active', 'on-break') and l.clock_out is null
  and l.clock_in < now() - interval '16 hours'
returning l.id, l.work_date, l.clock_in, l.status;
-- then run ONE of these:
-- commit;
-- rollback;

-- ── STEP 2b (only if step 1 listed other people too and you want them all cleared) ───────────────────
-- begin;
-- delete from public.attendance_logs
-- where status in ('active', 'on-break') and clock_out is null and clock_in < now() - interval '16 hours'
-- returning id, user_id, work_date, clock_in;
-- commit;   -- or rollback;

-- ── STEP 3: check ────────────────────────────────────────────────────────────────────────────────────
-- Run step 1 again: Achsah should no longer be listed, and her profile should show no running shift.
