// Audit log + close shift (migration 20261104090000): only triggers write the log, nobody can
// forge, edit or delete entries; watched changes are logged with the real account; managers
// close forgotten shifts only below their rank, with a real end time and a reason.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");

const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
const owner = "00000000-0000-0000-0000-000000000001", mgr = "00000000-0000-0000-0000-000000000002", staff = "00000000-0000-0000-0000-000000000003", mgrB = "00000000-0000-0000-0000-000000000004";
const T = ["branch_settings(branch_id uuid primary key, qr_required boolean, gps_mode text)",
  "payroll_runs(id uuid primary key default gen_random_uuid(), branch_id uuid, month text, status text)",
  "payroll_approvals(id uuid primary key default gen_random_uuid(), branch_id uuid, month text, note text, approved_by uuid)",
  "payroll_settings(branch_id uuid primary key, ot_daily_hours numeric, night_start text, night_end text, datev jsonb, updated_by text)",
  "tip_pools(branch_id uuid, week_start date, cash numeric, card numeric, updated_by uuid)",
  "wage_history(id bigint generated always as identity primary key, user_id uuid, branch_id uuid, hourly_wage numeric, effective_from date, recorded_by uuid)",
  "attendance_corrections(id uuid primary key default gen_random_uuid(), branch_id uuid, user_id uuid, type text, target_date date, status text, manager_note text)",
  "leave_requests(id uuid primary key default gen_random_uuid(), branch_id uuid, user_id uuid, from_date date, to_date date, status text)",
  "user_branches(user_id uuid, branch_id uuid)",
  "user_documents(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, doc_type text, file_name text, issue_date date, status text, rejection_reason text, uploaded_by uuid)",
  "branch_targets(branch_id uuid primary key, labour_pct numeric, purchase_pct numeric, prime_pct numeric, updated_by uuid)",
  "notifications(id uuid primary key default gen_random_uuid(), branch_id uuid, user_id uuid, type text, title text, message text)"];

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; grant usage on schema auth, private, public to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key);
    create table users(id uuid primary key, full_name text, role text, team text, branch_id uuid, status text, contract_type text, contract_hours numeric, employee_code text, phone text);
    create table audit_logs(id uuid primary key default gen_random_uuid(), branch_id uuid, action text, actor text, details text, created_at timestamptz default now());
    alter table audit_logs enable row level security;
    create policy audit_insert on audit_logs for insert with check (true);
    create policy audit_select on audit_logs for select to authenticated using (true);
    grant select, insert, update, delete on audit_logs to authenticated;
    create table attendance_logs(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, clock_in timestamptz, clock_out timestamptz, duration_mins int, status text, breaks jsonb default '[]', approval_status text default 'pending', source text);
    ${T.map((t) => `create table ${t};`).join("\n")}
    grant select, insert, update, delete on all tables in schema public to authenticated;
    create function public.accessible_branch_ids() returns setof uuid language sql stable security definer as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.is_manager() returns boolean language sql stable security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role in ('manager','branch_owner','brand_owner','super_admin')) $$;
    create function public.outranks(p_user uuid) returns boolean language sql stable security definer as $$
      select (select case role when 'super_admin' then 5 when 'brand_owner' then 4 when 'branch_owner' then 3 when 'manager' then 2 else 1 end from public.users where id = auth.uid())
           > (select case role when 'super_admin' then 5 when 'brand_owner' then 4 when 'branch_owner' then 3 when 'manager' then 2 else 1 end from public.users where id = p_user) $$;
    insert into branches values ('${A}'),('${B}');
    insert into users(id, full_name, role, branch_id, status) values ('${owner}','Olga Owner','branch_owner','${A}','active'),('${mgr}','Max Manager','manager','${A}','active'),('${staff}','Sam Staff','staff','${A}','active'),('${mgrB}','Bea','manager','${B}','active');
  `);
  await db.exec(fs.readFileSync("supabase/migrations/20261104090000_audit_log_and_close_shift.sql", "utf8"));
  const as = async (uid, sql, params = []) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`); try { return await db.query(sql, params); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)"); } };
  const last = async () => (await db.query("select * from audit_logs order by created_at desc, id desc limit 1")).rows[0];
  const count = async () => Number((await db.query("select count(*) n from audit_logs")).rows[0].n);

  // Nobody can forge, edit or delete audit entries.
  await assert.rejects(as(staff, "insert into audit_logs(branch_id, action, actor) values ($1,'fake','CEO')", [A]), /permission denied/);
  await assert.rejects(as(mgr, "delete from audit_logs"), /permission denied/);

  // Watched changes are logged with the real account; unwatched changes are not.
  await as(mgr, "insert into wage_history(user_id, branch_id, hourly_wage, effective_from, recorded_by) values ($1,$2,14.6,'2027-01-01',$3)", [staff, A, mgr]);
  let e = await last();
  assert.equal(e.action, "wage_set"); assert.equal(e.actor, "Max Manager"); assert.equal(e.actor_id, mgr); assert.equal(e.target_user, staff); assert.equal(e.changes.hourly_wage, 14.6);
  let n = await count();
  await as(mgr, "update users set phone = '123' where id = $1", [staff]);
  assert.equal(await count(), n, "Phone edits are not audit events");
  await as(mgr, "update users set contract_hours = 60 where id = $1", [staff]);
  e = await last(); assert.equal(e.action, "staff_updated"); assert.deepEqual(e.changes.contract_hours, { from: null, to: 60 });
  // Server-side writes without a session still name the person from the row.
  await db.exec(`insert into user_documents(user_id, branch_id, doc_type, file_name, status, uploaded_by) values ('${staff}','${A}','payslip','Lohnabrechnung 2026-10.pdf','approved','${owner}')`);
  e = await last(); assert.equal(e.action, "payslip_uploaded"); assert.equal(e.actor, "Olga Owner");
  n = await count();
  await db.exec(`insert into user_documents(user_id, branch_id, doc_type, file_name, status, uploaded_by) values ('${staff}','${A}','contract','c.pdf','pending','${staff}')`);
  assert.equal(await count(), n, "Staff uploading their own document is not an audit event");
  await as(mgr, "insert into attendance_corrections(branch_id, user_id, type, target_date, status) values ($1,$2,'forgot_out','2026-11-01','pending')", [A, staff]);
  await as(mgr, "update attendance_corrections set status = 'rejected', manager_note = 'no proof'");
  e = await last(); assert.equal(e.action, "correction_rejected");

  // Close a forgotten shift.
  const open = async (who, inAt, breaks = "[]") => (await db.query(`insert into attendance_logs(user_id, branch_id, clock_in, status, breaks) values ($1,$2,$3,'active',$4::jsonb) returning id`, [who, who === mgrB ? B : A, inAt, breaks])).rows[0].id;
  const close = (uid, id, out, reason = "forgot to clock out, confirmed by phone") => as(uid, "select public.manager_close_shift($1,$2,$3)", [id, out, reason]);
  const inAt = new Date(Date.now() - 10 * 3600e3).toISOString(), outAt = new Date(Date.now() - 2 * 3600e3).toISOString();
  const s1 = await open(staff, inAt, JSON.stringify([{ start: new Date(Date.now() - 6 * 3600e3).toISOString(), end: null }]));
  await assert.rejects(close(staff, s1, outAt), /Managers only/);
  await assert.rejects(close(mgrB, s1, outAt), /Shift not found/, "Other branch");
  await assert.rejects(close(mgr, s1, new Date(Date.now() + 3600e3).toISOString()), /not in the future/);
  await assert.rejects(close(mgr, s1, new Date(Date.parse(inAt) - 60e3).toISOString()), /after the clock-in/);
  await assert.rejects(close(mgr, s1, outAt, "x"), /short reason/);
  await close(mgr, s1, outAt);
  const row = (await db.query("select * from attendance_logs where id = $1", [s1])).rows[0];
  assert.equal(row.status, "complete"); assert.equal(row.source, "corrected"); assert.equal(row.approval_status, "pending", "Hours still go through approval");
  assert.equal(row.duration_mins, 480); assert.equal(Date.parse(row.breaks[0].end), Date.parse(outAt), "Open break ends with the shift");
  e = await last(); assert.equal(e.action, "shift_closed"); assert.equal(e.actor_id, mgr); assert.equal(e.target_user, staff);
  assert.equal((await db.query("select count(*) n from notifications where user_id = $1 and type = 'shift_closed'", [staff])).rows[0].n, 1);
  await assert.rejects(close(mgr, s1, outAt), /already closed/);
  const mine = await open(mgr, inAt);
  await assert.rejects(close(mgr, mine, outAt), /ranked below you/, "Not your own shift");
  await close(owner, mine, outAt); // the owner may close the manager's
  const long = await open(staff, new Date(Date.now() - 20 * 3600e3).toISOString());
  await assert.rejects(close(mgr, long, new Date().toISOString()), /within 16 hours/);
  console.log("Audit log: trigger-only, unforgeable, real accounts; close shift: rank, branch, time and reason rules hold.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
