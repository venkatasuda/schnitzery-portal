-- Auto clock-out: a shift still open 16 hours after clock-in is closed by the hourly notification_sweep().
-- It is closed with 0 worked minutes (we do not guess when the person left), marked source = 'auto_closed'
-- and left "pending" in Approvals, so a manager enters the real end time before anything is paid.
-- The employee and the branch managers are told. Until now an open shift ran on for weeks (one showed
-- 1,065 hours) and blocked the next clock-in.
begin;

create or replace function private.close_stale_shifts(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; m record; n integer := 0;
begin
  for r in
    select l.id, l.user_id, l.branch_id, l.clock_in, l.breaks, coalesce(u.full_name, 'An employee') as name
    from public.attendance_logs l left join public.users u on u.id = l.user_id
    where l.status in ('active', 'on-break') and l.clock_out is null and l.clock_in < p_now - interval '16 hours'
    for update of l skip locked
  loop
    update public.attendance_logs set
      clock_out = r.clock_in, duration_mins = 0, status = 'complete', approval_status = 'pending', source = 'auto_closed',
      -- an unfinished break ends at the clock-in too, so nothing is left open
      breaks = coalesce((select jsonb_agg(case when b ? 'start' and coalesce(b ->> 'end', '') = '' then b || jsonb_build_object('end', r.clock_in) else b end)
                         from jsonb_array_elements(case when jsonb_typeof(r.breaks) = 'array' then r.breaks else '[]'::jsonb end) b), '[]'::jsonb)
    where id = r.id;
    n := n + 1;
    perform public.notify(r.user_id, r.branch_id, 'forgot_checkout', 'auto:' || r.id::text,
      'Your shift from ' || to_char(r.clock_in at time zone 'Europe/Berlin', 'DD.MM. HH24:MI')
      || ' was never clocked out and was closed with 0 hours. Ask your manager to enter your real end time.', interval '7 days');
    for m in select id from public.users where branch_id = r.branch_id and status = 'active'
             and role in ('manager', 'branch_owner', 'brand_owner', 'super_admin') loop
      perform public.notify(m.id, r.branch_id, 'attendance_anomaly', 'auto:' || r.id::text,
        r.name || ': shift from ' || to_char(r.clock_in at time zone 'Europe/Berlin', 'DD.MM. HH24:MI')
        || ' closed automatically with 0 hours. Enter the real end time in Approvals.', interval '7 days');
    end loop;
  end loop;
  return n;
end $$;
revoke all on function private.close_stale_shifts(timestamptz) from public, anon, authenticated;

-- Run it from the hourly sweep (same patching approach as migration 20261111160000).
do $$
declare def text := pg_get_functiondef('public.notification_sweep()'::regprocedure); fixed text := def;
begin
  if position('close_stale_shifts' in fixed) = 0 then
    fixed := regexp_replace(fixed, 'end;\s*\$function\$\s*$', E'  perform private.close_stale_shifts();\nend; $function$');
    if position('close_stale_shifts' in fixed) = 0 then raise exception 'notification_sweep: end of function not found — review before applying'; end if;
    execute fixed;
  end if;
end $$;
revoke all on function public.notification_sweep() from public, anon, authenticated;
grant execute on function public.notification_sweep() to service_role;

commit;
