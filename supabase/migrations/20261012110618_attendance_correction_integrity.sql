-- A correction can affect only its employee, branch and recorded business day.
-- The guard also protects legacy RPCs: a failed final decision rolls back their
-- preceding attendance write, including duplicate missing-shift creations.
create function public.guard_attendance_correction() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare target public.attendance_logs%rowtype; start_time timestamptz; end_time timestamptz;
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'pending' then raise exception 'Correction already decided'; end if;
    if new.user_id is distinct from old.user_id or new.branch_id is distinct from old.branch_id
      or new.type is distinct from old.type or new.target_date is distinct from old.target_date
      or new.requested_clock_in is distinct from old.requested_clock_in
      or new.requested_clock_out is distinct from old.requested_clock_out
      or new.reason is distinct from old.reason or new.evidence_url is distinct from old.evidence_url
      or (old.attendance_log_id is not null and new.attendance_log_id is distinct from old.attendance_log_id)
      then raise exception 'Correction request fields are immutable; cancel and submit a new request'; end if;
  end if;
  if new.user_id is null or new.branch_id is null then raise exception 'Correction requires an employee and branch'; end if;
  -- Managers must be able to reject malformed legacy requests without applying them.
  if new.status = 'rejected' then return new; end if;
  if not isfinite(new.target_date)
    or new.type is null or new.type not in ('missing','incorrect','forgot_in','forgot_out')
    then raise exception 'Invalid correction request'; end if;
  if new.attendance_log_id is not null then
    select * into target from public.attendance_logs where id=new.attendance_log_id
      and user_id=new.user_id and branch_id=new.branch_id and work_date=new.target_date;
    if not found then raise exception 'Correction target does not belong to this employee, branch and date'; end if;
  elsif new.type <> 'missing' or new.status='approved' then
    raise exception 'Select the recorded shift for this correction';
  end if;
  start_time := coalesce(new.requested_clock_in,target.clock_in);
  end_time := coalesce(new.requested_clock_out,target.clock_out);
  if start_time is null or not isfinite(start_time) or (end_time is not null and
      (not isfinite(end_time) or end_time<=start_time or end_time-start_time>interval '7 days'))
      then raise exception 'Invalid correction clock times'; end if;
  if new.status='approved' and ((new.requested_clock_in is not null and target.clock_in is distinct from new.requested_clock_in)
      or (new.requested_clock_out is not null and target.clock_out is distinct from new.requested_clock_out))
      then raise exception 'Applied shift does not match the reviewed correction'; end if;
  return new;
end $$;
revoke all on function public.guard_attendance_correction() from public, anon, authenticated;
create trigger attendance_correction_integrity before insert or update on public.attendance_corrections
  for each row execute function public.guard_attendance_correction();
