begin;
set local lock_timeout='5s';
-- Never repair conflicting real shifts automatically. This fails for review if
-- an existing user has more than one open shift (preflight found none).
create unique index attendance_one_open_shift on public.attendance_logs(user_id)
  where user_id is not null and status in ('active','on-break');

create schema attendance_replay;
revoke all on schema attendance_replay from public,anon;
grant usage on schema attendance_replay to authenticated;

create function attendance_replay.apply_events(p_events jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid(); branch uuid; qr boolean; gps text;
  e jsonb; event_id uuid; action text; at_time timestamptz; code text; device text;
  log_id uuid; error_text text; result_status text; valid_code boolean; last_break integer;
  shift public.attendance_logs%rowtype; previous_event public.attendance_events%rowtype;
  latest_break timestamptz; results jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then raise exception 'Invalid event batch'; end if;
  select branch_id into branch from public.users where id=uid and status='active'
    and role in ('staff','manager','branch_owner','brand_owner','super_admin') for update;
  if branch is null then raise exception 'Active branch membership required'; end if;
  select qr_required,gps_mode into qr,gps from public.branch_settings where branch_id=branch;
  for e in select value from jsonb_array_elements(p_events) loop
    if e->>'user_id' is distinct from uid::text then raise exception 'Event owner mismatch'; end if;
    event_id := (e->>'event_uuid')::uuid;
    action := e->>'action'; at_time := (e->>'captured_at')::timestamptz;
    code := e->>'code'; device := left(e->>'device_id',64);
    if event_id is null or at_time is null or not isfinite(at_time)
      or action is null or action not in ('clock_in','clock_out','break_start','break_end') then raise exception 'Invalid attendance event'; end if;
    select * into previous_event from public.attendance_events where event_uuid=event_id;
    if found then
      if previous_event.user_id is distinct from uid then raise exception 'Event owner mismatch'; end if;
      if previous_event.action is distinct from action or previous_event.captured_at is distinct from at_time then raise exception 'Event identity conflict'; end if;
      results := results || jsonb_build_object('event_uuid',event_id,'status',case when previous_event.error is not null then 'recorded_with_error' else 'duplicate' end);
      continue;
    end if;
    error_text := null; log_id := null; valid_code := null;
    if e->>'capture_protocol' is distinct from '2' then error_text := 'legacy_capture_needs_review'; end if;
    -- ponytail: automatic replay covers seven days; older evidence is retained
    -- for the existing correction/manager-review workflow, never discarded.
    if at_time > now()+interval '5 minutes' or at_time < now()-interval '7 days' then error_text := 'capture_time_needs_review'; end if;
    if coalesce(qr,false) then
      valid_code := public.code_valid_at(branch,code,at_time,4);
      if valid_code is distinct from true then error_text := 'qr_not_verified'; end if;
    end if;
    if gps='required' then error_text := 'offline_location_not_verified'; end if;
    if error_text is null then
      begin
        select * into shift from public.attendance_logs where user_id=uid and branch_id=branch
          and status in ('active','on-break') for update;
        if action='clock_in' then
          if shift.id is not null then error_text := 'already_clocked_in';
          elsif exists(select 1 from public.attendance_logs l where l.user_id=uid
            and l.clock_in<=at_time and l.clock_out>at_time) then error_text := 'overlapping_shift';
          else
            insert into public.attendance_logs(user_id,branch_id,work_date,clock_in,status,approval_status,breaks,source,device_id)
              values(uid,branch,(at_time at time zone 'Europe/Berlin')::date,at_time,'active','pending','[]','offline',device) returning id into log_id;
          end if;
        elsif shift.id is null then error_text := 'no_open_session';
        else
          select max(moment::timestamptz) into latest_break from jsonb_array_elements(coalesce(shift.breaks,'[]')) b
            cross join lateral (values (b->>'start'),(b->>'end')) times(moment);
          if at_time < greatest(shift.clock_in,latest_break) then error_text := 'non_monotonic_time';
          elsif action='clock_out' and exists(select 1 from public.attendance_logs l where l.user_id=uid
            and l.id<>shift.id and l.clock_in<at_time and l.clock_out>shift.clock_in) then error_text := 'overlapping_shift';
          elsif action='clock_out' then
            if shift.status='on-break' then
              last_break := jsonb_array_length(shift.breaks)-1;
              if last_break is null or last_break < 0 then raise exception 'Missing open break'; end if;
              shift.breaks := jsonb_set(shift.breaks,array[last_break::text,'end'],to_jsonb(at_time));
            end if;
            update public.attendance_logs set clock_out=at_time,status='complete',approval_status='pending',breaks=shift.breaks,
              duration_mins=round(extract(epoch from (at_time-shift.clock_in))/60.0),source='offline'
              where id=shift.id;
            log_id := shift.id;
          elsif action='break_start' and shift.status='active' then
            update public.attendance_logs set status='on-break',breaks=coalesce(breaks,'[]')||jsonb_build_array(jsonb_build_object('start',at_time)) where id=shift.id;
            log_id := shift.id;
          elsif action='break_end' and shift.status='on-break' then
            last_break := jsonb_array_length(shift.breaks)-1;
            if last_break is null or last_break < 0 then raise exception 'Missing open break'; end if;
            update public.attendance_logs set status='active',breaks=jsonb_set(breaks,array[last_break::text,'end'],to_jsonb(at_time)) where id=shift.id;
            log_id := shift.id;
          else error_text := 'invalid_break_sequence';
          end if;
        end if;
      exception when others then error_text := 'apply_error: '||sqlstate; log_id := null;
      end;
    end if;
    result_status := case when error_text is null then 'applied' else 'recorded_with_error' end;
    insert into public.attendance_events(event_uuid,user_id,branch_id,device_id,action,captured_at,source,code,code_valid,sync_status,attendance_log_id,error)
      values(event_id,uid,branch,device,action,at_time,'offline',code,valid_code,result_status,log_id,error_text);
    results := results||jsonb_build_object('event_uuid',event_id,'status',result_status,'error',error_text);
  end loop;
  return jsonb_build_object('results',results);
end $$;
revoke all on function attendance_replay.apply_events(jsonb) from public,anon;
grant execute on function attendance_replay.apply_events(jsonb) to authenticated;
create or replace function public.sync_attendance_events(p_events jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select attendance_replay.apply_events(p_events) $$;
revoke all on function public.sync_attendance_events(jsonb) from public,anon;
grant execute on function public.sync_attendance_events(jsonb) to authenticated;

create table public.attendance_event_reviews (
  event_id uuid primary key references public.attendance_events(id),
  branch_id uuid not null,
  reviewed_by uuid not null,
  note text not null check (length(trim(note)) between 1 and 2000),
  reviewed_at timestamptz not null default now()
);
alter table public.attendance_event_reviews enable row level security;
revoke all on public.attendance_event_reviews from public,anon,authenticated,service_role;
grant select on public.attendance_event_reviews to authenticated,service_role;
grant insert(event_id,branch_id,reviewed_by,note) on public.attendance_event_reviews to authenticated;
create policy event_reviews_read on public.attendance_event_reviews for select to authenticated
  using (((select public.is_manager()) and branch_id in (select public.accessible_branch_ids()))
    or exists(select 1 from public.attendance_events e where e.id=event_id and e.user_id=(select auth.uid())));
create policy event_reviews_record on public.attendance_event_reviews for insert to authenticated
  with check ((select public.is_manager()) and reviewed_by=(select auth.uid()) and branch_id in (select public.accessible_branch_ids())
    and exists(select 1 from public.attendance_events e where e.id=event_id and e.branch_id=attendance_event_reviews.branch_id and e.error is not null));
create view public.offline_attendance_issues with (security_invoker=true) as
  select e.id,e.user_id,e.branch_id,u.full_name,e.action,e.captured_at,e.error,e.created_at,r.note,r.reviewed_at
  from public.attendance_events e left join public.users u on u.id=e.user_id
  left join public.attendance_event_reviews r on r.event_id=e.id
  where e.source='offline' and e.error is not null;
revoke all on public.offline_attendance_issues from public,anon;
grant select on public.offline_attendance_issues to authenticated;
commit;
