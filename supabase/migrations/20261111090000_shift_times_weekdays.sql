-- Shift times per weekday group: optional Friday + Saturday times (e.g. Evening until 02:00),
-- and "time pending" (no start/end yet, e.g. Mid). Existing rows keep their times unchanged.
begin;
alter table public.shift_times add column if not exists fri_sat_start time;
alter table public.shift_times add column if not exists fri_sat_end time;
alter table public.shift_times alter column start_time drop not null;
alter table public.shift_times alter column end_time drop not null;
alter table public.shift_times drop constraint if exists shift_times_pairs;
alter table public.shift_times add constraint shift_times_pairs check (
  (start_time is null) = (end_time is null) and (fri_sat_start is null) = (fri_sat_end is null));
notify pgrst, 'reload schema';
commit;
