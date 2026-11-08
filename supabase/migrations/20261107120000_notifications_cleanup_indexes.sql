-- Phase 2 housekeeping, from the read-only production health check (7 Nov 2026).
-- 1. 96% of notifications were repeated kiosk_offline alerts created before the
--    one-per-kiosk fix (20261104100000). They are stale; drop those older than 7 days.
-- 2. The bell list reads notifications by user, newest first: index that exact order.
-- 3. Checklists are read by branch and date range.
-- 4. Drop indexes fully covered by another index (they only slow writes).

delete from public.notifications
where type = 'kiosk_offline' and created_at < now() - interval '7 days';

create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);
drop index if exists public.idx_notif_user;            -- covered by notifications_user_created

create index if not exists checklists_branch_date on public.checklists (branch_id, work_date);
drop index if exists public.idx_checklist_branch;      -- covered by checklists_branch_date

drop index if exists public.idx_roster_branch_week;    -- same columns as unique roster_one_branch_week
drop index if exists public.idx_roster_branch;         -- covered by roster_one_branch_week
drop index if exists public.idx_inv_counts_branch;     -- covered by inventory_counts_branch_date_idx
drop index if exists public.idx_attendance_branch;     -- covered by idx_att_branch_date
drop index if exists public.idx_attendance_user;       -- covered by idx_att_user_date
