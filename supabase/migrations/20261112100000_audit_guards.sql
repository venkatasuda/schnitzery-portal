-- Audit 12 Nov 2026 (docs/ops/PRINCIPAL-AUDIT-2026-11-12.md): close three gaps at the database boundary.
--
-- 1. publish_roster publishes exactly the draft the app checked (ENG1). The app reads the draft, runs the
--    working-time rules, then calls this with that same draft; if another manager saved a different draft in
--    between, publishing is refused instead of putting an unchecked roster live.
-- 2. publish_roster refuses a draft that names anyone who is not an active member of the branch (SEC2).
-- 3. Staff cannot change their own team, team skills or contract type by writing to the table directly (SEC1).
--    Team skills (Skill 2, 3 …) decide where the planner may put someone, so they are manager-set.
--
-- Not covered here, on purpose: the rest / overlap rules themselves stay in the app (src/lib/roster/check.ts).
-- A manager who calls this function directly with the current draft can still publish without that check.

-- ── 1 + 2: publish ────────────────────────────────────────────────────────────────────────────────────
drop function if exists public.publish_roster(uuid, date);
drop function if exists private.publish_roster(uuid, date);

create or replace function private.publish_roster(p_branch uuid, p_week date, p_expected jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare d public.roster_drafts%rowtype; live jsonb; uid uuid; n integer := 0;
begin
  if auth.uid() is null or not public.is_manager() or p_branch not in (select public.accessible_branch_ids())
    then raise exception 'Managers only' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('roster:' || p_branch::text || ':' || p_week::text, 0));
  select * into d from public.roster_drafts where branch_id = p_branch and week_start = p_week for update;
  if not found then raise exception 'No draft to publish' using errcode = '22023'; end if;
  -- The draft changed after it was checked (another manager saved in between).
  if p_expected is null or d.roster_data is distinct from p_expected
    then raise exception 'Draft changed since it was checked' using errcode = '40001'; end if;
  select roster_data into live from public.weekly_roster where branch_id = p_branch and week_start = p_week for update;
  -- Someone changed the live roster after this draft started (e.g. an approved cover/swap).
  if live is distinct from d.base_data then raise exception 'Roster changed since this draft' using errcode = '40001'; end if;
  -- Everyone on the roster must be an active member of this branch.
  if exists (
    select 1 from jsonb_each(d.roster_data) as days(day, arr), jsonb_array_elements(days.arr) as e
    where not exists (select 1 from public.users u where u.id::text = e ->> 'user_id' and u.branch_id = p_branch and u.status = 'active')
  ) then raise exception 'Roster staff must be active in this branch' using errcode = '23514'; end if;

  insert into public.weekly_roster (branch_id, week_start, roster_data, published_at, published_by)
  values (p_branch, p_week, d.roster_data, now(), auth.uid())
  on conflict (branch_id, week_start) do update set roster_data = excluded.roster_data, published_at = now(), published_by = auth.uid();
  delete from public.roster_drafts where branch_id = p_branch and week_start = p_week;
  for uid in select distinct (e ->> 'user_id')::uuid from jsonb_each(d.roster_data) as days(day, arr), jsonb_array_elements(days.arr) as e
             where e ->> 'user_id' is not null loop
    perform public.notify(uid, p_branch, 'roster', 'roster:' || p_week::text || ':' || floor(extract(epoch from now()))::bigint::text,
      'Your shifts for the week of ' || to_char(p_week, 'DD.MM.') || ' are published.', interval '1 minute');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.publish_roster(uuid, date, jsonb) from public, anon;
grant execute on function private.publish_roster(uuid, date, jsonb) to authenticated;
create or replace function public.publish_roster(p_branch uuid, p_week date, p_expected jsonb) returns integer
language sql security invoker set search_path = '' as $$ select private.publish_roster(p_branch, p_week, p_expected) $$;
revoke all on function public.publish_roster(uuid, date, jsonb) from public, anon;
grant execute on function public.publish_roster(uuid, date, jsonb) to authenticated;

-- ── 3: own team / team skills / contract type ─────────────────────────────────────────────────────────
-- The team names inside a skills list, lower-cased, in order (same aliases as src/lib/roster/teams.ts).
create or replace function private.team_skills(p text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(lower(btrim(s)) order by ord), '{}')
  from unnest(coalesce(p, '{}'::text[])) with ordinality as t(s, ord)
  where lower(btrim(s)) = any (array['preparation','prep','vorbereitung','kitchen','küche','kueche','cashier','kasse','kassierer',
    'dishwashing','dishwasher','spüler','spueler','spülküche','spuelkueche','manager','allrounder','all-rounder'])
$$;

-- A separate trigger, so the existing users guard stays exactly as installed.
create or replace function public.guard_users_team_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); my_role text;
begin
  if me is null or old.id <> me then return new; end if; -- backend, or someone else's row (the existing guard and policy apply)
  if new.contract_type is distinct from old.contract_type
    then raise exception 'You cannot change your own contract type.' using errcode = '42501'; end if;
  select role into my_role from public.users where id = me;
  if coalesce(my_role, 'staff') in ('staff', 'kiosk')
     and (new.team is distinct from old.team or private.team_skills(new.skills) is distinct from private.team_skills(old.skills))
    then raise exception 'Your team and team skills are set by your manager.' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.guard_users_team_fields() from public, anon, authenticated;
drop trigger if exists guard_users_team_fields on public.users;
create trigger guard_users_team_fields before update on public.users
  for each row execute function public.guard_users_team_fields();

notify pgrst, 'reload schema';
