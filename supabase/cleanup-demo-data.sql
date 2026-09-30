-- ============================================================================
-- CLEANUP DEMO / PITCH DATA  — MANUAL TEARDOWN, run at handover.
--
-- This is NOT an ordered migration. Do not auto-apply it. Run it by hand in the
-- Supabase SQL editor when you want to hand the client a clean production system.
--
-- It removes ONLY the demo data seeded for the pitch, scoped to the Stuttgart
-- branch and identified by tags (source='seed', note='[demo]', counted_by='Demo',
-- demo unit names). Real data entered through the app is left untouched.
--
-- ⚠ Review before running. Take a backup first. daily_sales can't be tagged, so
--   its delete is keyed on the seed DATE — adjust it if you seeded on another day.
-- ============================================================================

-- Stuttgart branch
-- 20b8cb3e-2046-40d7-9f5e-c7ef18261bd6

begin;

-- Attendance (historical + today's live states) — all tagged source='seed'
delete from public.attendance_logs
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and source = 'seed';

-- Inventory counts (tagged counted_by='Demo')
delete from public.inventory_counts
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and counted_by = 'Demo';

-- Deliveries, waste, expiry batches (tagged note='[demo]')
delete from public.inventory_purchases
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and note = '[demo]';
delete from public.waste_log
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and note = '[demo]';
delete from public.stock_batches
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and note = '[demo]';

-- Announcements + incidents (tagged in text)
delete from public.announcements
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and title like '[demo]%';
delete from public.incidents
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and description like '[demo]%';

-- Temperature units + their logs (demo unit names only)
delete from public.temp_logs
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6'
   and unit_id in (select id from public.temp_units
                   where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6'
                     and name in ('Walk-in Fridge','Chest Freezer'));
delete from public.temp_units
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6'
   and name in ('Walk-in Fridge','Chest Freezer');

-- Demo inventory catalogue (the 8 seeded products)
delete from public.inventory_master
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6'
   and product in ('Pork Schnitzel','Chicken Schnitzel','French Fries','Potato Salad',
                   'Mixed Leaves','Mushroom Sauce','Pretzel Rolls','Apfelschorle 0.5L');

-- Daily sales — NOT tag-able (no note column). Seeded rows were created on the
-- seed date; this removes those while keeping any real rows entered earlier.
-- >>> ADJUST THIS DATE to the day you seeded (default: 2026-09-30) <<<
delete from public.daily_sales
 where branch_id = '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6'
   and created_at >= date '2026-09-30';

commit;

-- ── Verify (should all be 0 after commit) ───────────────────────────────────
select
  (select count(*) from public.attendance_logs where branch_id='20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and source='seed') as attendance_left,
  (select count(*) from public.inventory_purchases where branch_id='20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and note='[demo]') as deliveries_left,
  (select count(*) from public.waste_log where branch_id='20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and note='[demo]') as waste_left,
  (select count(*) from public.inventory_counts where branch_id='20b8cb3e-2046-40d7-9f5e-c7ef18261bd6' and counted_by='Demo') as counts_left;

-- ── NOTE: demo LOGIN accounts are separate (they live in Supabase Auth, not here).
-- To remove the four demo.* accounts too, run:  node scripts/ops/create-demo-accounts.mjs --delete
-- Leave them if the client still wants click-through demo logins.
