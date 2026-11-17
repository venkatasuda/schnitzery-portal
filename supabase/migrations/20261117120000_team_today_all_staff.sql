-- "Today's team" for every employee of the branch (Venky, 17 Nov 2026), not only shift leaders.
-- Plain employees see names, team, planned shift and in / break / done / not in; the clock-in time and minutes late
-- stay visible to shift leaders and managers only (returned as null / 0 for others).
-- Function body otherwise unchanged from 20261114120000_team_today.sql. Run once before merging; safe to run twice.
begin;

create or replace function private.team_today(p_branch uuid)
returns table (user_id uuid, name text, team text, shift text, status text, clock_in timestamptz, late_mins integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  full_view boolean;
  d date := (now() at time zone 'Europe/Berlin')::date;
  days text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  r jsonb;
begin
  -- Any active employee of the branch sees who works today; clock-in time and lateness only for shift leaders / managers.
  if auth.uid() is null or p_branch not in (select public.accessible_branch_ids())
     or not exists (select 1 from public.users where id = auth.uid() and status = 'active') then
    raise exception 'Branch access required' using errcode = '42501';
  end if;
  full_view := private.can_plan_prep(p_branch);
  select w.roster_data into r from public.weekly_roster w
  where w.branch_id = p_branch and w.week_start = d - (extract(isodow from d)::int - 1);

  return query
  with planned as (
    select distinct on ((x ->> 'user_id')::uuid) (x ->> 'user_id')::uuid as uid, x ->> 'team' as team, x ->> 'shift' as shift
    from jsonb_array_elements(coalesce(r -> days[extract(isodow from d)::int], '[]'::jsonb)) x
    where x ->> 'user_id' ~ '^[0-9a-fA-F-]{36}$'
  ), logs as (
    -- today's shifts, plus a shift still open from last night (the latest one per person wins)
    select distinct on (l.user_id) l.user_id as uid, l.status, l.clock_in, coalesce(l.late_mins, 0) as late
    from public.attendance_logs l
    where l.branch_id = p_branch and (l.work_date = d or l.status in ('active', 'on-break'))
    order by l.user_id, l.clock_in desc nulls last
  ), people as (select uid from planned union select uid from logs)
  select p.uid, u.full_name, coalesce(pl.team, u.team), pl.shift,
         case lg.status when 'active' then 'in' when 'on-break' then 'break' when 'complete' then 'done' else 'not_in' end,
         case when full_view then lg.clock_in end, case when full_view then coalesce(lg.late, 0) else 0 end::integer
  from people p
  join public.users u on u.id = p.uid and u.status = 'active'
  left join planned pl on pl.uid = p.uid
  left join logs lg on lg.uid = p.uid
  order by u.full_name;
end $$;

notify pgrst, 'reload schema';
commit;
