// Team checklist templates (migration 20261108090000 + Stuttgart seed): managers only write
// templates, branch members read them, a day's copy is unique per template, the seed is idempotent.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", OTHER = "00000000-0000-0000-0000-00000000000c";
const MGR = "00000000-0000-0000-0000-000000000001", STAFF = "00000000-0000-0000-0000-000000000002";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table public.branches(id uuid primary key, name text, is_active boolean default true);
    create table public.users(id uuid primary key, role text, branch_id uuid);
    create table public.checklists(id uuid primary key default gen_random_uuid(), branch_id uuid, work_date date not null, type text, task text, done boolean default false, input_kind text default 'check', value text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_manager() returns boolean language sql as $$ select exists(select 1 from public.users where id = auth.uid() and role <> 'staff') $$;
    create function public.accessible_branch_ids() returns setof uuid language sql as $$ select branch_id from public.users where id = auth.uid() $$;
    insert into public.branches values ('${B}', 'Schnitzery Stuttgart', true), ('${OTHER}', 'Other', true);
    insert into public.users values ('${MGR}', 'manager', '${B}'), ('${STAFF}', 'staff', '${B}');
    grant usage on schema public, auth to authenticated; grant select on public.users, public.branches to authenticated;
    grant execute on all functions in schema public, auth to authenticated;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261108090000_checklist_templates.sql", "utf8"));
  const as = async (uid, sql) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql); } finally { await db.exec("reset role;"); } };
  const add = (uid, branch) => as(uid, `insert into public.checklist_templates(branch_id, team, task, weekdays) values ('${branch}', 'Kitchen', 'Clean fryers', '{1,3}')`);

  await add(MGR, B);
  await assert.rejects(add(STAFF, B), /row-level security/, "Staff cannot create templates");
  await assert.rejects(add(MGR, OTHER), /row-level security/, "Managers cannot write another branch");
  assert.equal((await as(STAFF, "select count(*)::int n from public.checklist_templates")).rows[0].n, 1, "Staff read their branch's templates");
  await assert.rejects(db.query(`insert into public.checklist_templates(branch_id, team, task, weekdays) values ('${B}', 'Kitchen', 'Bad day', '{8}')`), /check/, "Weekday outside 1–7 refused");

  const t = (await db.query("select id from public.checklist_templates limit 1")).rows[0].id;
  const copy = `insert into public.checklists(branch_id, work_date, template_id, task) values ('${B}', '2026-11-09', '${t}', 'Clean fryers') on conflict (branch_id, work_date, template_id) do nothing`;
  await db.exec(copy); await db.exec(copy);
  assert.equal((await db.query("select count(*)::int n from public.checklists")).rows[0].n, 1, "One copy per template per day, even when opened twice");
  await db.exec(`insert into public.checklists(branch_id, work_date, task) values ('${B}', '2026-11-09', 'Hand task'), ('${B}', '2026-11-09', 'Hand task 2')`);
  assert.equal((await db.query("select count(*)::int n from public.checklists")).rows[0].n, 3, "Hand-added tasks (no template) never conflict");

  const seed = fs.readFileSync("scripts/ops/seed-stuttgart-checklist-templates.sql", "utf8");
  await db.exec(seed);
  const n1 = (await db.query("select count(*)::int n from public.checklist_templates")).rows[0].n;
  await db.exec(seed);
  assert.equal((await db.query("select count(*)::int n from public.checklist_templates")).rows[0].n, n1, "Seed is idempotent");
  assert.ok(n1 > 40, "Seed loads the document's tasks");
  assert.equal((await db.query("select count(*)::int n from public.checklist_templates where section = 'Lager' and weekdays = '{2,5}'")).rows[0].n, 7, "Lager tasks only on Tue + Fri");
  console.log(`Checklist templates: manager-only writes, branch-scoped reads, one copy per day, idempotent seed (${n1} templates).`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
