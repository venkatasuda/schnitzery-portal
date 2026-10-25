// Security hardening (migration 20261024200000): direct database writes that the app's
// buttons never offer must be refused by the database itself. Runs the real migration on
// a minimal copy of the production tables (PGlite) and attacks it as each role.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const PG = process.env.PGLITE_PATH || path.join(__dirname, "../../.audit-db/node_modules/@electric-sql/pglite");
const { PGlite } = require(PG);

const MIG = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261024200000_security_hardening.sql"), "utf8");
const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const mgrA = id(1), mgrA2 = id(2), staffA = id(3), staffA2 = id(4), owner = id(5), mgrC = id(6), staffA3 = id(7);

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key, gps_lat float8, gps_lng float8, gps_radius_m int);
    create table branch_settings(branch_id uuid primary key, gps_mode text);
    create table users(id uuid primary key, branch_id uuid, role text, status text default 'active', full_name text, phone text, email text,
      contract_hours numeric, annual_leave_days numeric, employee_code text, login_locked boolean default false, must_change_password boolean default false);
    create table user_branches(user_id uuid, branch_id uuid, primary key(user_id, branch_id));
    create table user_pay(user_id uuid primary key, branch_id uuid, hourly_wage numeric, effective_from date, updated_by uuid, updated_at timestamptz);
    create table wage_history(id serial primary key, user_id uuid, branch_id uuid, hourly_wage numeric, effective_from date, recorded_by uuid);
    create table attendance_logs(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, approval_status text, duration_mins int, geo_flagged boolean, geo_max_distance_m float8);
    create table attendance_corrections(id serial primary key, user_id uuid, branch_id uuid, status text);
    create table leave_requests(id serial primary key, user_id uuid, branch_id uuid, status text);
    create table swap_requests(id serial primary key, branch_id uuid, requester_id uuid, other_person_id uuid, status text);
    create table cover_requests(id serial primary key, branch_id uuid, requester_id uuid, claimer_id uuid, status text);
    create table incidents(id serial primary key, branch_id uuid, reported_by uuid, description text, status text);
    create table audit_logs(id serial primary key, branch_id uuid, action text, actor text);
    create table checklists(id serial primary key, branch_id uuid, work_date date, type text, task text, done boolean, completed_by uuid, completed_at timestamptz, input_kind text, value text);
    create table certifications(id serial primary key, branch_id uuid, user_id uuid, cert_type text);
    create table shift_broadcasts(id serial primary key, branch_id uuid, note text);
    create table temp_units(id serial primary key, branch_id uuid, name text, is_active boolean);
    create table availability(id serial primary key, branch_id uuid, user_id uuid, days jsonb);
    create table kiosks(id uuid primary key, branch_id uuid);
    create function public.role_rank(p_role text) returns int language sql immutable as $$
      select case p_role when 'super_admin' then 5 when 'brand_owner' then 4 when 'branch_owner' then 3 when 'manager' then 2 when 'staff' then 1 else 0 end $$;
    create function public.current_role() returns text language sql stable security definer set search_path = public as $$ select role from public.users where id = auth.uid() $$;
    create function public.current_branch() returns uuid language sql stable security definer set search_path = public as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.is_manager() returns boolean language sql stable security definer set search_path = public as $$ select public.current_role() in ('manager','branch_owner','brand_owner','super_admin') $$;
    create function public.accessible_branch_ids() returns setof uuid language sql stable security definer set search_path to 'public' as $$
      select b.id from public.branches b
      where public.current_role() in ('super_admin','brand_owner')
         or (public.current_role() in ('manager','staff','branch_owner') and b.id = public.current_branch())
         or (public.current_role() in ('manager','branch_owner') and b.id in (select ub.branch_id from public.user_branches ub where ub.user_id = auth.uid())) $$;
    create function public.user_in_my_branches(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.users u where u.id = p_user and u.branch_id in (select public.accessible_branch_ids())) $$;
    create function public.distance_m(a float8, b float8, c float8, d float8) returns float8 language sql immutable as $$ select 99999::float8 $$;
    create function public.resolve_kiosk(p_branch uuid, p_kiosk uuid) returns uuid language sql as $$ select p_kiosk $$;
    create function public.notification_sweep() returns void language sql as $$ select $$;
    create function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval) returns void language sql as $$ select $$;
    -- production trigger shells (the migration replaces the function bodies)
    create function public.guard_users_sensitive_update() returns trigger language plpgsql as $$ begin return new; end $$;
    create trigger trg_guard_users_sensitive before update on users for each row execute function public.guard_users_sensitive_update();
    do $$ declare t text; begin
      foreach t in array array['users','user_pay','attendance_logs','attendance_corrections','leave_requests','swap_requests','cover_requests','incidents','audit_logs','checklists','certifications','shift_broadcasts','temp_units','availability'] loop
        execute format('alter table %I enable row level security', t);
      end loop; end $$;
    create policy users_select on users for select using (id = auth.uid() or branch_id in (select public.accessible_branch_ids()));
    create policy att_manage on attendance_logs to authenticated using (public.is_manager() and branch_id in (select public.accessible_branch_ids())) with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
    create policy att_select_own on attendance_logs for select to authenticated using (user_id = auth.uid());
    create policy corr_manage on attendance_corrections to authenticated using (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
    create policy leave_manage on leave_requests to authenticated using (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
    create policy swap_select on swap_requests for select using (branch_id in (select public.accessible_branch_ids()));
    create policy cover_select on cover_requests for select using (branch_id in (select public.accessible_branch_ids()));
    create policy checklist_select on checklists for select using (branch_id in (select public.accessible_branch_ids()));
    create policy avail_select on availability for select using (branch_id in (select public.accessible_branch_ids()));
    grant usage on schema public to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
    grant usage on all sequences in schema public to authenticated, service_role;
    insert into branches(id, gps_lat, gps_lng) values ('${A}', 1, 1), ('${B}', 1, 1), ('${C}', 1, 1);
    insert into branch_settings values ('${A}', 'warn');
    insert into users(id, branch_id, role, contract_hours, must_change_password) values
      ('${mgrA}','${A}','manager',40,true), ('${mgrA2}','${A}','manager',40,false), ('${staffA}','${A}','staff',20,false),
      ('${staffA2}','${A}','staff',20,false), ('${owner}','${A}','brand_owner',null,false), ('${mgrC}','${C}','manager',40,false), ('${staffA3}','${A}','staff',10,false);
    insert into user_branches values ('${mgrA}','${B}');
    insert into user_pay values ('${mgrA}','${A}',15,null,null,null), ('${staffA}','${A}',13,null,null,null);
    insert into attendance_logs(user_id, branch_id, approval_status) values ('${mgrA}','${A}','pending'), ('${staffA}','${A}','pending'), ('${owner}','${A}','pending');
    insert into attendance_corrections(user_id, branch_id, status) values ('${mgrA}','${A}','pending'), ('${staffA}','${A}','pending');
    insert into leave_requests(user_id, branch_id, status) values ('${mgrA}','${A}','pending');
    insert into swap_requests(branch_id, requester_id, status) values ('${A}','${mgrA}','pending'), ('${A}','${staffA}','pending');
    insert into cover_requests(branch_id, requester_id, status) values ('${A}','${staffA}','open');
    insert into incidents(branch_id, reported_by, description, status) values ('${A}','${staffA2}','slip','open');
    insert into checklists(branch_id, work_date, type, task, done, input_kind) values ('${A}', current_date, 'opening', 'Clean grill', false, 'check');
    insert into availability(branch_id, user_id, days) values ('${A}','${staffA2}','{}');
  `);
  await db.exec(MIG);

  const as = async (uid, sql) => {
    await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub','${uid || ""}',false)`);
    try { return await db.query(sql); } finally { await db.exec("reset role"); }
  };
  const refused = async (uid, sql, why) => {
    let r; try { r = await as(uid, sql); } catch { return; } // exception = refused
    assert.equal(r.affectedRows ?? r.rows.length, 0, why);   // or: nothing changed
  };
  const allowed = async (uid, sql, why) => { const r = await as(uid, sql); assert.ok((r.affectedRows ?? r.rows.length) > 0, why); };

  // B1 — own sensitive fields
  await refused(mgrA, `update users set branch_id='${C}' where id='${mgrA}'`, "manager cannot move themselves into another branch");
  await refused(mgrA, `update users set contract_hours=80 where id='${mgrA}'`, "no own contract change");
  await refused(staffA, `update users set role='manager' where id='${staffA}'`, "staff cannot promote themselves");
  await refused(staffA, `update users set status='inactive' where id='${staffA}'`, "no own lock/status change");
  await allowed(staffA, `update users set phone='123' where id='${staffA}'`, "own contact details stay editable");
  await allowed(mgrA, `update users set must_change_password=false where id='${mgrA}'`, "clearing own change-password flag stays possible");
  // B4 — others: strictly below you, into your own branches only
  await allowed(mgrA, `update users set contract_hours=25 where id='${staffA}'`, "manager edits staff");
  await refused(mgrA, `update users set contract_hours=10 where id='${mgrA2}'`, "manager cannot edit an equal-rank manager");
  await refused(mgrA, `update users set role='staff' where id='${mgrA2}'`, "manager cannot demote another manager");
  await refused(mgrA, `update users set branch_id='${C}' where id='${staffA}'`, "cannot move staff into a branch you don't run");
  await allowed(mgrA, `update users set branch_id='${B}' where id='${staffA3}'`, "can move staff into a linked branch");
  await refused(owner, `update users set role='super_admin' where id='${staffA}'`, "brand owner cannot mint super admins");

  // B2 — wages
  await refused(mgrA, `update user_pay set hourly_wage=99 where user_id='${mgrA}'`, "no own wage change");
  await allowed(mgrA, `update user_pay set hourly_wage=14 where user_id='${staffA}'`, "manager sets staff wage");
  await assert.rejects(db.query(`select public.set_wage_effective('${mgrA}','${mgrA}',99,current_date)`), /own wage/);

  // B3 — own shifts and requests
  await refused(mgrA, `update attendance_logs set approval_status='approved' where user_id='${mgrA}'`, "no self-approved shift");
  await refused(mgrA, `update attendance_logs set duration_mins=6000 where user_id='${mgrA}'`, "no own hours edit");
  await allowed(mgrA, `update attendance_logs set approval_status='approved' where user_id='${staffA}'`, "manager approves staff shift");
  await allowed(owner, `update attendance_logs set approval_status='approved' where user_id='${owner}'`, "brand owner (top) approves own shift");
  await refused(mgrA, `update attendance_corrections set status='approved' where user_id='${mgrA}'`, "no self-approved correction");
  await refused(mgrA, `update leave_requests set status='approved' where user_id='${mgrA}'`, "no self-approved leave");
  await refused(mgrA, `update swap_requests set status='approved' where requester_id='${mgrA}'`, "no self-approved swap");

  // C — staff tampering
  await refused(staffA, `update swap_requests set status='approved' where requester_id='${staffA}'`, "staff cannot approve swaps");
  await allowed(staffA, `insert into swap_requests(branch_id, requester_id, status) values ('${A}','${staffA}','pending') returning id`, "staff request a swap");
  await refused(staffA, `update cover_requests set status='approved' where requester_id='${staffA}'`, "requester cannot approve own cover");
  await allowed(staffA2, `update cover_requests set claimer_id='${staffA2}', status='claimed' where status='open'`, "colleague claims open cover");
  await refused(staffA, `delete from incidents`, "staff cannot delete incidents");
  await refused(staffA, `select * from incidents`, "staff cannot read others' incident reports");
  await refused(staffA, `insert into audit_logs(branch_id, action, actor) values ('${A}','x','y') returning id`, "staff cannot forge audit entries");
  await allowed(staffA, `update checklists set done=true, completed_by='${staffA}', completed_at=now()`, "staff tick checklist");
  await refused(staffA, `update checklists set task='nothing'`, "staff cannot rewrite tasks");
  await refused(staffA, `update checklists set completed_by='${staffA2}'`, "staff cannot tick in someone else's name");
  await refused(staffA, `delete from checklists`, "staff cannot delete checklist tasks");
  await refused(staffA, `update availability set days='{"x":1}' where user_id='${staffA2}'`, "no editing a colleague's availability");
  await refused(staffA, `insert into temp_units(branch_id, name, is_active) values ('${A}','fake',true) returning id`, "staff cannot add fridges");
  await refused(staffA, `insert into certifications(branch_id, user_id, cert_type) values ('${A}','${staffA}','x') returning id`, "staff cannot add certificates");

  // D — internal helpers
  const mgrLog = (await db.query(`select id from attendance_logs where user_id='${mgrA}'`)).rows[0].id;
  await as(staffA, `select public.geo_checkpoint('${mgrLog}', 5, 5)`);
  assert.equal((await db.query(`select geo_flagged from attendance_logs where id='${mgrLog}'`)).rows[0].geo_flagged, null, "cannot flag someone else's shift");
  await assert.rejects(as(null, `select public.notification_sweep()`), "anon cannot run the sweep");
  await assert.rejects(as(staffA, `select public.resolve_kiosk('${A}', null)`), "users cannot fake kiosk heartbeats");

  console.log("Security hardening: self-promotion, self-pay, self-approval, staff tampering and public internal functions are refused.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
