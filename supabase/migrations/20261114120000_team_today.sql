-- "Today's team" for shift leaders: who is planned today and whether they are in, on a break, done or not in yet.
-- Staff can only read their own attendance rows (RLS), so shift leaders get this one narrow read instead:
-- their branch, today only (Europe/Berlin), names + team + planned shift + clock state. No pay, no history, no edits.
-- Managers may call it too (same rights as prep planning: private.can_plan_prep).
begin;

create or replace function private.team_today(p_branch uuid)
returns table (user_id uuid, name text, team text, shift text, status text, clock_in timestamptz, late_mins integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  d date := (now() at time zone 'Europe/Berlin')::date;
  days text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  r jsonb;
begin
  if auth.uid() is null or not private.can_plan_prep(p_branch) then
    raise exception 'Shift leaders only' using errcode = '42501';
  end if;
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
         lg.clock_in, coalesce(lg.late, 0)::integer
  from people p
  join public.users u on u.id = p.uid and u.status = 'active'
  left join planned pl on pl.uid = p.uid
  left join logs lg on lg.uid = p.uid
  order by u.full_name;
end $$;
revoke all on function private.team_today(uuid) from public, anon;
grant execute on function private.team_today(uuid) to authenticated;

create or replace function public.team_today(p_branch uuid)
returns table (user_id uuid, name text, team text, shift text, status text, clock_in timestamptz, late_mins integer)
language sql stable security invoker set search_path = '' as $$ select * from private.team_today(p_branch) $$;
revoke all on function public.team_today(uuid) from public, anon;
grant execute on function public.team_today(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
