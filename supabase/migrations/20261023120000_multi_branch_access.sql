-- Multi-branch access (docs/MULTI-BRANCH.md).
-- A manager/branch owner can be linked to extra branches in user_branches, and
-- accessible_branch_ids() already returns home + linked branches. 19 older policies
-- and three functions still compared against the HOME branch only, so a linked
-- branch's waste, deliveries, temperature logs, batches, transfers, cover requests,
-- payroll approval and wage entry failed. This aligns them with accessible_branch_ids().
-- Staff are unaffected: for staff accessible_branch_ids() is exactly the home branch.
-- Brand owners/super admins already have every branch in accessible_branch_ids().
begin;
set local lock_timeout = '3s';

drop policy "batches_insert" on "public"."stock_batches";
create policy "batches_insert" on "public"."stock_batches" FOR INSERT WITH CHECK ((("branch_id" IN (SELECT public.accessible_branch_ids())) AND ("logged_by" = "auth"."uid"())));
drop policy "batches_select" on "public"."stock_batches";
create policy "batches_select" on "public"."stock_batches" FOR SELECT USING (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "batches_update" on "public"."stock_batches";
create policy "batches_update" on "public"."stock_batches" FOR UPDATE USING (("branch_id" IN (SELECT public.accessible_branch_ids()))) WITH CHECK (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "cover_insert" on "public"."cover_requests";
create policy "cover_insert" on "public"."cover_requests" FOR INSERT WITH CHECK ((("requester_id" = "auth"."uid"()) AND ("branch_id" IN (SELECT public.accessible_branch_ids()))));
drop policy "cover_select" on "public"."cover_requests";
create policy "cover_select" on "public"."cover_requests" FOR SELECT USING (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "cover_update" on "public"."cover_requests";
create policy "cover_update" on "public"."cover_requests" FOR UPDATE USING (("branch_id" IN (SELECT public.accessible_branch_ids()))) WITH CHECK (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "inventory_purchases_delete" on "public"."inventory_purchases";
create policy "inventory_purchases_delete" on "public"."inventory_purchases" FOR DELETE USING ((("branch_id" IN (SELECT public.accessible_branch_ids())) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['manager'::"text", 'branch_owner'::"text", 'brand_owner'::"text", 'super_admin'::"text"]))));
drop policy "inventory_purchases_insert" on "public"."inventory_purchases";
create policy "inventory_purchases_insert" on "public"."inventory_purchases" FOR INSERT WITH CHECK ((("branch_id" IN (SELECT public.accessible_branch_ids())) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['manager'::"text", 'branch_owner'::"text", 'brand_owner'::"text", 'super_admin'::"text"]))));
drop policy "inventory_purchases_select" on "public"."inventory_purchases";
create policy "inventory_purchases_select" on "public"."inventory_purchases" FOR SELECT USING (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "inventory_purchases_update" on "public"."inventory_purchases";
create policy "inventory_purchases_update" on "public"."inventory_purchases" FOR UPDATE USING ((("branch_id" IN (SELECT public.accessible_branch_ids())) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['manager'::"text", 'branch_owner'::"text", 'brand_owner'::"text", 'super_admin'::"text"]))));
drop policy "temp_logs_insert" on "public"."temp_logs";
create policy "temp_logs_insert" on "public"."temp_logs" FOR INSERT WITH CHECK ((("branch_id" IN (SELECT public.accessible_branch_ids())) AND ("recorded_by" = "auth"."uid"())));
drop policy "temp_logs_select" on "public"."temp_logs";
create policy "temp_logs_select" on "public"."temp_logs" FOR SELECT USING (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "temp_units_select" on "public"."temp_units";
create policy "temp_units_select" on "public"."temp_units" FOR SELECT USING (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "temp_units_write" on "public"."temp_units";
create policy "temp_units_write" on "public"."temp_units" USING (("branch_id" IN (SELECT public.accessible_branch_ids()))) WITH CHECK (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "transfers_insert" on "public"."stock_transfers";
create policy "transfers_insert" on "public"."stock_transfers" FOR INSERT WITH CHECK (("to_branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "transfers_select" on "public"."stock_transfers";
create policy "transfers_select" on "public"."stock_transfers" FOR SELECT USING ((("from_branch_id" IN (SELECT public.accessible_branch_ids())) OR ("to_branch_id" IN (SELECT public.accessible_branch_ids()))));
drop policy "transfers_update" on "public"."stock_transfers";
create policy "transfers_update" on "public"."stock_transfers" FOR UPDATE USING ((("from_branch_id" IN (SELECT public.accessible_branch_ids())) OR ("to_branch_id" IN (SELECT public.accessible_branch_ids()))));
drop policy "waste_insert" on "public"."waste_log";
create policy "waste_insert" on "public"."waste_log" FOR INSERT WITH CHECK ((("branch_id" IN (SELECT public.accessible_branch_ids())) AND ("logged_by" = "auth"."uid"())));
drop policy "waste_select" on "public"."waste_log";
create policy "waste_select" on "public"."waste_log" FOR SELECT USING (("branch_id" IN (SELECT public.accessible_branch_ids())));
drop policy "userdocs_manager_read" on "public"."user_documents";
create policy "userdocs_manager_read" on "public"."user_documents" for select to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

create or replace function public.set_payroll_approval_atomic(p_actor uuid, p_branch uuid, p_month text, p_approve boolean, p_revision text, p_snapshot jsonb, p_note text)
returns void language plpgsql security invoker set search_path = '' set lock_timeout = '3s' as $$
declare inputs jsonb; source_data jsonb; approval uuid; caller_name text; run public.payroll_runs%rowtype;
begin
  if not exists(select 1 from public.users where id=p_actor and role in ('manager','branch_owner','brand_owner','super_admin')) then raise exception 'Manager branch access denied'; end if;
  -- Branch access (home + linked branches) is checked below via accessible_branch_ids().
  -- Request-scoped identity for the existing authorization helpers; callable
  -- only with the server's service-role key, never an employee's JWT.
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b = p_branch) then raise exception 'Branch access denied'; end if;
  if p_approve is null or length(coalesce(p_note,'')) > 2000 then raise exception 'Invalid approval request'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or left(p_month,4)::integer < 2000 then raise exception 'Invalid month'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_branch::text || ':payroll:' || p_month, 0));
  select * into run from public.payroll_runs where branch_id = p_branch and month = p_month for update;
  if p_approve then
    if run.status = 'approved' then raise exception 'Already approved; reload payroll'; end if;
    if p_month >= to_char(now() at time zone 'Europe/Berlin','YYYY-MM') then raise exception 'Close the month before final approval'; end if;
    -- ponytail: brief table locks prevent phantom shifts and wage changes during
    -- approval; replace with branch-scoped revision triggers if contention grows.
    lock table public.attendance_logs, public.users, public.user_pay, public.wage_history, public.payroll_settings in share mode;
    inputs := public.get_payroll_inputs(p_branch, p_month);
    source_data := inputs -> 'source';
    if p_revision is distinct from inputs ->> 'revision' then raise exception 'Payroll changed; reload and review before approval'; end if;
    if jsonb_array_length(source_data -> 'logs') = 0 then raise exception 'No completed shifts'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where l ->> 'approval_status' is distinct from 'approved') then raise exception 'Every completed shift must be approved first'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where l ->> 'clock_in' is null or l ->> 'clock_out' is null
      or (l ->> 'clock_out')::timestamptz <= (l ->> 'clock_in')::timestamptz) then raise exception 'Invalid completed attendance'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where
      not exists(select 1 from jsonb_array_elements(source_data -> 'staff') u where u ->> 'id' = l ->> 'user_id') or
      not exists(select 1 from jsonb_array_elements(source_data -> 'wages') w where w ->> 'user_id' = l ->> 'user_id' and w ->> 'work_date' = l ->> 'work_date'
        and (w ->> 'hourly_wage')::numeric >= 0 and (w ->> 'hourly_wage')::numeric < 'Infinity'::numeric)) then raise exception 'Every worked employee needs a valid wage and branch assignment'; end if;
    if p_snapshot ->> 'wageBasis' is distinct from 'effective-dated' then raise exception 'Reload the updated payroll before approval'; end if;
    if p_snapshot is null or p_snapshot ->> 'month' is distinct from p_month or
       p_snapshot ->> 'revision' is distinct from p_revision or
       jsonb_typeof(p_snapshot -> 'rows') is distinct from 'array' or
       jsonb_typeof(p_snapshot -> 'totals') is distinct from 'object' or
       p_snapshot -> 'settings' is distinct from source_data -> 'settings' then raise exception 'Invalid payroll snapshot'; end if;
    select coalesce(full_name,'Manager') into caller_name from public.users where id = auth.uid();
    insert into public.payroll_approvals(branch_id,month,snapshot,source,approved_by,approved_name,note)
      values(p_branch,p_month,p_snapshot,source_data,auth.uid(),caller_name,p_note) returning id into approval;
    insert into public.payroll_runs(branch_id,month,status,approved_by,approved_at,note,approval_id)
      values(p_branch,p_month,'approved',caller_name,now(),p_note,approval)
      on conflict(branch_id,month) do update set status='approved',approved_by=excluded.approved_by,
        approved_at=excluded.approved_at,note=excluded.note,approval_id=excluded.approval_id;
  else
    if run.status is distinct from 'approved' then raise exception 'Payroll is no longer approved; reload'; end if;
    if run.approval_id is not null and p_revision is distinct from
      (select snapshot ->> 'revision' from public.payroll_approvals where id=run.approval_id)
      then raise exception 'Approval changed; reload before reopening'; end if;
    -- Retain the old approval in the immutable archive when reopening.
    update public.payroll_runs set status='draft',approved_by=null,approved_at=null,note=p_note,approval_id=null
      where branch_id=p_branch and month=p_month;
  end if;
end $$;

create or replace function public.set_wage_effective(p_actor uuid,p_user uuid,p_wage numeric,p_date date) returns void
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare target_branch uuid; current_rate public.wage_history%rowtype;
begin
  if not exists(select 1 from public.users where id=p_actor and role in ('manager','branch_owner','brand_owner','super_admin')) then raise exception 'Managers only'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  -- Lock an existing employee row, including the first wage entry, to serialize edits.
  select branch_id into target_branch from public.users where id=p_user for update;
  if target_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b=target_branch) then raise exception 'Not in your branch'; end if;
  if p_date is null or not isfinite(p_date) or p_date<'2000-01-01' or p_date>(now() at time zone 'Europe/Berlin')::date
    or (p_wage is not null and not (p_wage>=0 and p_wage<'Infinity'::numeric)) then raise exception 'Invalid wage or effective date'; end if;
  insert into public.wage_history(user_id,branch_id,hourly_wage,effective_from,recorded_by)
    values(p_user,target_branch,p_wage,p_date,p_actor);
  select * into current_rate from public.wage_history where user_id=p_user and branch_id=target_branch
    and effective_from is not null order by effective_from desc,id desc limit 1;
  insert into public.user_pay(user_id,branch_id,hourly_wage,effective_from,updated_by,updated_at)
    values(p_user,target_branch,current_rate.hourly_wage,current_rate.effective_from,p_actor,now())
    on conflict(user_id) do update set branch_id=excluded.branch_id,hourly_wage=excluded.hourly_wage,
      effective_from=excluded.effective_from,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
end $$;
revoke all on function public.set_wage_effective(uuid,uuid,numeric,date) from public,anon,authenticated;
grant execute on function public.set_wage_effective(uuid,uuid,numeric,date) to service_role;

-- Managers of linked branches also get "pending" notifications.
CREATE OR REPLACE FUNCTION "public"."notify_correction_submitted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_name text;
begin
  begin
    select full_name into v_name from public.users where id = new.user_id;
    insert into public.notifications (branch_id, user_id, type, title, message)
    select new.branch_id, u.id, 'correction_pending', new.type, coalesce(v_name, '')
    from public.users u
    where u.role in ('manager','branch_owner','brand_owner','super_admin')
      and (u.branch_id = new.branch_id or exists(select 1 from public.user_branches ub where ub.user_id = u.id and ub.branch_id = new.branch_id));
  exception when others then null; end;
  return new;
end; $$;

CREATE OR REPLACE FUNCTION "public"."audit_user_document"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor   text;
  v_action  text;
  v_details text;
begin
  select full_name into v_actor from public.users where id = auth.uid();
  v_actor := coalesce(v_actor, 'system');

  -- audit_logs (best-effort)
  begin
    if tg_op = 'INSERT' then
      insert into public.audit_logs (branch_id, action, actor, details)
      values (new.branch_id, 'document_uploaded', v_actor, new.doc_type || ' v' || new.version_no);
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      v_action := case new.status
        when 'approved' then 'document_approved'
        when 'rejected' then 'document_rejected'
        when 'archived' then 'document_archived'
        else 'document_updated' end;
      v_details := new.doc_type || coalesce(' — ' || new.rejection_reason, '');
      insert into public.audit_logs (branch_id, action, actor, details)
      values (new.branch_id, v_action, v_actor, v_details);
    end if;
  exception when others then null;
  end;

  -- notifications (best-effort).
  -- title = doc_type CODE (the UI localizes it); message = uploader name or reason.
  begin
    if tg_op = 'INSERT' then
      insert into public.notifications (branch_id, user_id, type, title, message)
      select new.branch_id, u.id, 'doc_pending', new.doc_type, coalesce(v_actor, '')
      from public.users u
      where u.role in ('manager', 'branch_owner', 'brand_owner', 'super_admin')
        and (u.branch_id = new.branch_id or exists(select 1 from public.user_branches ub where ub.user_id = u.id and ub.branch_id = new.branch_id));

    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
      if new.status = 'approved' then
        insert into public.notifications (branch_id, user_id, type, title, message)
        values (new.branch_id, new.user_id, 'doc_approved', new.doc_type, '');
      elsif new.status = 'rejected' then
        insert into public.notifications (branch_id, user_id, type, title, message)
        values (new.branch_id, new.user_id, 'doc_rejected', new.doc_type, coalesce(new.rejection_reason, ''));
      end if;
    end if;
  exception when others then null;
  end;

  return new;
end;
$$;

commit;
