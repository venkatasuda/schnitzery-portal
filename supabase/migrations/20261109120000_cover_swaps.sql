-- Shift swaps through the existing cover flow (no new table).
-- A colleague who claims an open cover request may offer one of their own shifts in return.
-- On approval both roster entries move in one transaction, so the roster (and every dashboard,
-- attendance comparison and payroll figure built on it) always shows who really works.
-- The legacy swap_requests table stays for history; the app no longer creates swaps there.
begin;

alter table public.cover_requests
  add column if not exists return_work_date date,
  add column if not exists return_team text,
  add column if not exists return_shift text;
alter table public.cover_requests drop constraint if exists cover_return_complete;
alter table public.cover_requests add constraint cover_return_complete check (
  (return_work_date is null and return_team is null and return_shift is null)
  or (return_work_date is not null and return_team is not null and return_shift is not null));

-- Move one rostered shift from one person to another (caller's RLS applies: managers only can write rosters).
create or replace function private.move_roster_shift(p_branch uuid, p_date date, p_team text, p_shift text, p_from uuid, p_to uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.weekly_roster%rowtype; d text; entries jsonb; idx integer; to_name text;
begin
  d := (array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])[extract(isodow from p_date)::integer];
  select full_name into to_name from public.users where id = p_to and branch_id = p_branch;
  if not found then raise exception 'Colleague no longer in branch'; end if;
  select * into r from public.weekly_roster where branch_id = p_branch
    and week_start = p_date - (extract(isodow from p_date)::integer - 1) for update;
  if not found then raise exception 'Shift no longer in the roster'; end if;
  entries := coalesce(r.roster_data -> d, '[]'::jsonb);
  select ordinal::integer - 1 into idx from jsonb_array_elements(entries) with ordinality as s(entry, ordinal)
    where entry ->> 'user_id' = p_from::text and entry ->> 'team' = p_team and entry ->> 'shift' = p_shift limit 1;
  if idx is null then raise exception 'Shift no longer in the roster'; end if;
  if exists (select 1 from jsonb_array_elements(entries) as s(entry) where entry ->> 'user_id' = p_to::text and entry ->> 'shift' = p_shift)
    then raise exception 'Claimant already scheduled for this shift'; end if;
  entries := jsonb_set(entries, array[idx::text], (entries -> idx) || jsonb_build_object('user_id', p_to, 'name', to_name));
  update public.weekly_roster set roster_data = jsonb_set(coalesce(r.roster_data, '{}'::jsonb), array[d], entries) where id = r.id;
  if not found then raise exception 'Roster update denied'; end if;
end $$;
revoke all on function private.move_roster_shift(uuid, date, text, text, uuid, uuid) from public, anon;
grant execute on function private.move_roster_shift(uuid, date, text, text, uuid, uuid) to authenticated;

create or replace function public.decide_cover_atomic(p_id uuid, p_decision text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare c public.cover_requests%rowtype; caller_branch uuid; caller_name text;
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_decision not in ('approved', 'rejected') or p_decision is null then raise exception 'Invalid decision'; end if;
  select branch_id, full_name into caller_branch, caller_name from public.users where id = auth.uid();
  select * into c from public.cover_requests where id = p_id for update;
  if not found or c.branch_id is distinct from caller_branch then raise exception 'Request not found'; end if;
  if c.status not in ('open', 'claimed') then raise exception 'Already actioned'; end if;
  if p_decision = 'approved' then
    if c.status <> 'claimed' or c.claimer_id is null or c.claimer_id = c.requester_id then raise exception 'No valid claimant'; end if;
    if c.day <> (array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])[extract(isodow from c.work_date)::integer] then raise exception 'Shift date and day disagree'; end if;
    perform private.move_roster_shift(c.branch_id, c.work_date, c.team, c.shift, c.requester_id, c.claimer_id);
    -- Swap: the claimer's offered shift goes to the requester in the same transaction.
    if c.return_work_date is not null then
      perform private.move_roster_shift(c.branch_id, c.return_work_date, c.return_team, c.return_shift, c.claimer_id, c.requester_id);
    end if;
  end if;
  update public.cover_requests set status = p_decision, resolved_by = caller_name, resolved_at = now() where id = p_id;
  if not found then raise exception 'Cover decision denied'; end if;
  return p_decision = 'approved';
end $$;
revoke all on function public.decide_cover_atomic(uuid, text) from public, anon;
grant execute on function public.decide_cover_atomic(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
