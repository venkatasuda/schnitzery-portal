// Multi-branch access (migration 20261023120000): a manager linked to a second branch
// can work in it; managers of other branches and staff cannot. Uses the production
// definition of accessible_branch_ids (inlined below) and the new policies/functions from the migration itself.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");

const MIG = fs.readFileSync("supabase/migrations/20261023120000_multi_branch_access.sql", "utf8");
const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";
const mgrA = "00000000-0000-0000-0000-000000000001"; // home A, linked to B
const staffB = "00000000-0000-0000-0000-000000000002";
const mgrC = "00000000-0000-0000-0000-000000000003";
const staffA = "00000000-0000-0000-0000-000000000004";

// Policy/function statements for one table, taken verbatim from the migration.
const policiesFor = (table) => MIG.split("\n").filter((l) => l.startsWith("create policy") && l.includes(`"public"."${table}"`)).join("\n");
const fnFromMigration = (name) => MIG.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`))[0];

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated, service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key);
    create table users(id uuid primary key, branch_id uuid, role text, status text default 'active', full_name text);
    create table user_branches(user_id uuid, branch_id uuid, primary key(user_id, branch_id));
    create function public.current_role() returns text language sql stable security definer set search_path = public as $$ select role from public.users where id = auth.uid() $$;
    create function public.current_branch() returns uuid language sql stable security definer set search_path = public as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.is_manager() returns boolean language sql stable security definer set search_path = public as $$ select public.current_role() in ('manager','branch_owner','brand_owner','super_admin') $$;
    create table waste_log(id serial primary key, branch_id uuid, logged_by uuid, product text);
    create table stock_transfers(id serial primary key, from_branch_id uuid, to_branch_id uuid, status text);
    create table wage_history(id serial primary key, user_id uuid, branch_id uuid, hourly_wage numeric, effective_from date, recorded_by uuid);
    create table user_pay(user_id uuid primary key, branch_id uuid, hourly_wage numeric, effective_from date, updated_by uuid, updated_at timestamptz);
    alter table waste_log enable row level security; alter table stock_transfers enable row level security;
    grant usage on schema public to authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
    grant usage on all sequences in schema public to authenticated, service_role;
    insert into branches values ('${A}'),('${B}'),('${C}');
    insert into users(id, branch_id, role) values ('${mgrA}','${A}','manager'),('${staffB}','${B}','staff'),('${mgrC}','${C}','manager'),('${staffA}','${A}','staff');
    insert into user_branches values ('${mgrA}','${B}');
    insert into waste_log(branch_id, logged_by, product) values ('${A}','${staffA}','a'),('${B}','${staffB}','b'),('${C}','${mgrC}','c');
    insert into stock_transfers(from_branch_id, to_branch_id, status) values ('${C}','${B}','requested'),('${C}','${C}','requested');
  `);
  // Production definition of accessible_branch_ids() (production schema export, 2026-10-21).
  await db.exec(`create function public.accessible_branch_ids() returns setof uuid language sql stable security definer set search_path to 'public' as $$
    select b.id from public.branches b
    where public.current_role() in ('super_admin','brand_owner')
       or (public.current_role() in ('manager','staff','branch_owner') and b.id = public.current_branch())
       or (public.current_role() in ('manager','branch_owner')
           and b.id in (select ub.branch_id from public.user_branches ub where ub.user_id = auth.uid()));
  $$`);
  await db.exec(policiesFor("waste_log") + "\n" + policiesFor("stock_transfers"));
  await db.exec(fnFromMigration("set_wage_effective"));

  const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`); try { return await fn(); } finally { await db.exec("reset role"); } };
  const products = async () => (await db.query("select product from waste_log order by product")).rows.map((r) => r.product);

  assert.deepEqual(await as(mgrA, products), ["a", "b"], "Linked manager sees home + linked branch");
  assert.deepEqual(await as(mgrC, products), ["c"], "Other manager sees only own branch");
  assert.deepEqual(await as(staffB, products), ["b"], "Staff see only home branch");
  await as(mgrA, () => db.query("insert into waste_log(branch_id, logged_by, product) values ($1,$2,'b2')", [B, mgrA]));
  await assert.rejects(as(mgrC, () => db.query("insert into waste_log(branch_id, logged_by, product) values ($1,$2,'x')", [B, mgrC])), /row-level security/);
  await assert.rejects(as(staffA, () => db.query("insert into waste_log(branch_id, logged_by, product) values ($1,$2,'x')", [B, staffA])), /row-level security/, "Staff cannot write to a branch they are not in");
  assert.equal((await as(mgrA, () => db.query("select count(*)::int n from stock_transfers"))).rows[0].n, 1, "Linked manager sees transfers into the linked branch");

  // Wage entry: allowed for a linked branch, refused for an unrelated one.
  await db.exec("set role service_role");
  await db.query("select public.set_wage_effective($1,$2,15,'2020-01-01')", [mgrA, staffB]);
  await assert.rejects(db.query("select public.set_wage_effective($1,$2,15,'2020-01-01')", [mgrC, staffB]), /Not in your branch/);
  await assert.rejects(db.query("select public.set_wage_effective($1,$2,15,'2020-01-01')", [staffA, staffB]), /Managers only/);
  await db.exec("reset role");

  // Payroll approval no longer requires the HOME branch; branch access is still enforced.
  const pay = fnFromMigration("set_payroll_approval_atomic");
  assert.ok(!/branch_id=p_branch and role/.test(pay), "Payroll approval must not require the home branch");
  assert.ok(/accessible_branch_ids\(\) b where b = p_branch/.test(pay), "Payroll approval still checks branch access");
  assert.ok(!/"users"\."branch_id"\s*FROM/.test(MIG), "No home-branch-only policy may remain in the migration");

  console.log("Multi-branch access: linked branches open for their managers; other branches and staff stay closed; wage and payroll follow the same rule.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
