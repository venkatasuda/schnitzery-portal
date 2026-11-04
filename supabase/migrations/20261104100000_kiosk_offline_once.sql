-- Audit round 3: one "Kiosk offline" alert per kiosk, not one every hour.
-- notification_sweep() runs hourly and keys kiosk alerts as 'kiosk:<id>:<YYYY-MM-DD-HH>', so the
-- duplicate check (same title) never matched and managers got a new alert every hour
-- (149 of 150 notifications in production). For kiosk_offline, the duplicate check now
-- ignores the hour: while an unread alert for that kiosk exists, no new one is added.
begin;
set local lock_timeout = '3s';
create or replace function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval default '12:00:00'::interval)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if p_user is null then return; end if;
  if p_type = 'kiosk_offline' and p_title like 'kiosk:%:%' then
    if exists (select 1 from public.notifications
               where user_id = p_user and type = 'kiosk_offline' and is_read = false
                 and title like split_part(p_title, ':', 1) || ':' || split_part(p_title, ':', 2) || ':%') then return; end if;
  elsif exists (select 1 from public.notifications
             where user_id = p_user and type = p_type and title = p_title and is_read = false and created_at > now() - p_window) then
    return;
  end if;
  insert into public.notifications (branch_id, user_id, type, title, message)
  values (p_branch, p_user, p_type, p_title, p_message);
end; $function$;
commit;
