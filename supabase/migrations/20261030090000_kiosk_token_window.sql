-- Kiosk offline window: 30 minutes (owner decision, 2026-10-29).
-- A kiosk pre-loads upcoming clock-in codes so it keeps working without internet.
-- It used to fetch up to 1,000 windows (8+ hours): anyone who copied them from the
-- kiosk could clock in remotely for the rest of the day. Now at most 60 windows of
-- 30 s = 30 minutes; an online kiosk refreshes every ~5 minutes.
-- clock_code_batch also listed the retired role 'franchise_owner' and missed
-- branch_owner / super_admin; it now uses the same rule as clock_token_batch.
begin;
set local lock_timeout = '3s';

create or replace function public.clock_token_batch(p_kiosk uuid default null, p_count integer default 240) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); v_role text; v_branch uuid; v_kiosk uuid; v_w bigint; v_arr jsonb := '[]'::jsonb; i int;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if not (public.is_manager() or v_role = 'kiosk') then raise exception 'Not permitted.'; end if;
  v_kiosk := public.resolve_kiosk(v_branch, p_kiosk);
  p_count := least(greatest(coalesce(p_count, 60), 1), 60); -- 30 minutes max (default kept at 240 for compatibility; the cap applies)
  v_w := floor(extract(epoch from now()) / 30)::bigint;
  for i in 0 .. (p_count - 1) loop
    v_arr := v_arr || jsonb_build_object('w', v_w + i, 'token', public.clock_token_for(v_branch, v_kiosk, v_w + i), 'code', public.clock_code_for(v_branch, v_w + i));
  end loop;
  return jsonb_build_object('ok', true, 'branchId', v_branch, 'kioskId', v_kiosk, 'rotateSeconds', 30, 'startWindow', v_w, 'codes', v_arr);
end; $$;

create or replace function public.clock_code_batch(p_count integer default 240) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); v_role text; v_branch uuid; v_w bigint; v_arr jsonb := '[]'::jsonb; i int;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;
  if not (public.is_manager() or v_role = 'kiosk') then raise exception 'Not permitted.'; end if;
  p_count := least(greatest(coalesce(p_count, 60), 1), 60); -- 30 minutes max (default kept at 240 for compatibility; the cap applies)
  v_w := floor(extract(epoch from now()) / 30)::bigint;
  for i in 0 .. (p_count - 1) loop
    v_arr := v_arr || jsonb_build_object('w', v_w + i, 'code', public.clock_code_for(v_branch, v_w + i));
  end loop;
  return jsonb_build_object('ok', true, 'branchId', v_branch, 'rotateSeconds', 30, 'startWindow', v_w, 'codes', v_arr);
end; $$;

revoke all on function public.clock_token_batch(uuid, integer) from public, anon;
grant execute on function public.clock_token_batch(uuid, integer) to authenticated, service_role;
revoke all on function public.clock_code_batch(integer) from public, anon;
grant execute on function public.clock_code_batch(integer) to authenticated, service_role;

commit;
