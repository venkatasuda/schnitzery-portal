// Daily prep list (migration 20261108120000): who may plan, the to-prepare rule, version
// conflicts, drafts hidden from staff, and notifications only to that day's Preparation roster.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", OTHER = "00000000-0000-0000-0000-00000000000c";
const MGR = "00000000-0000-0000-0000-000000000001", LEAD = "00000000-0000-0000-0000-000000000002", PREP = "00000000-0000-0000-0000-000000000003", COOK = "00000000-0000-0000-0000-000000000004";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table public.branches(id uuid primary key, name text);
    create table public.users(id uuid primary key, role text, branch_id uuid, status text default 'active');
    create table public.weekly_roster(id uuid primary key default gen_random_uuid(), branch_id uuid, week_start date, roster_data jsonb);
    create table public.inventory_recipe_yields(id uuid primary key);
    create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, type text, title text, message text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_manager() returns boolean language sql security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role <> 'staff') $$;
    create function public.accessible_branch_ids() returns setof uuid language sql security definer as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval default '12:00:00') returns void language sql security definer
      as $$ insert into public.notifications(user_id, branch_id, type, title, message) values (p_user, p_branch, p_type, p_title, p_message) $$;
    alter table public.branches add column is_active boolean default true;
    insert into public.branches values ('${B}', 'Schnitzery Stuttgart'), ('${OTHER}', 'Other');
    insert into public.users values ('${MGR}', 'manager', '${B}'), ('${LEAD}', 'staff', '${B}'), ('${PREP}', 'staff', '${B}'), ('${COOK}', 'staff', '${B}');
    grant usage on schema public, auth, private to authenticated; grant select on all tables in schema public to authenticated;
    grant execute on all functions in schema public, auth to authenticated;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261108120000_prep_lists.sql", "utf8"));
  const as = async (uid, sql, params) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql, params); } finally { await db.exec("reset role;"); } };
  const item = (await db.query(`insert into public.prep_items(branch_id, name, unit, container_size, target_max, reserve) values ('${B}', 'Chicken', 'kg', 20, '{120,120,120,120,160,220,150}', '{40,40,40,40,40,40,40}') returning id`)).rows[0].id;
  const day = (await db.query("select ((now() at time zone 'Europe/Berlin')::date + 1)::text d")).rows[0].d;
  // Roster for tomorrow: PREP on Preparation, COOK on Kitchen; COOK is on Preparation the day after (must not be notified).
  await db.exec(`insert into public.weekly_roster(branch_id, week_start, roster_data)
    select '${B}', date_trunc('week', d)::date, jsonb_build_object(trim(to_char(d, 'FMDay')),
      jsonb_build_array(jsonb_build_object('user_id','${PREP}','team','Preparation'), jsonb_build_object('user_id','${COOK}','team','Kitchen')),
      trim(to_char(d + 1, 'FMDay')), jsonb_build_array(jsonb_build_object('user_id','${COOK}','team','Preparation')))
    from (select '${day}'::date d) x`);
  const lines = (leftover, override = null) => JSON.stringify([{ item_id: item, target: 160, reserve: 40, leftover, override }]);
  const save = (uid, l, send, v, d = day) => as(uid, "select public.save_prep_list($1, $2::date, $3::jsonb, null, $4, $5) r", [B, d, l, send, v]);

  await assert.rejects(save(LEAD, lines(35), false, 0), /Prep planning access required/, "Staff without the switch cannot plan");
  await assert.rejects(as(LEAD, `insert into public.shift_leaders(branch_id, user_id) values ('${B}', '${LEAD}')`), /row-level security/, "Staff cannot grant themselves");
  await as(MGR, `insert into public.shift_leaders(branch_id, user_id) values ('${B}', '${LEAD}')`);
  const draft = (await save(LEAD, lines(35), false, 0)).rows[0].r;
  assert.equal(draft.status, "draft");
  assert.equal(Number((await db.query("select to_prepare from public.prep_list_lines")).rows[0].to_prepare), 125, "160 target − 35 left = 125");
  assert.equal((await as(PREP, "select count(*)::int n from public.prep_lists")).rows[0].n, 0, "Staff do not see drafts");
  await assert.rejects(save(LEAD, lines(35), false, 0), /changed/, "Stale version refused");
  await save(LEAD, lines(null), false, draft.version);
  assert.equal(Number((await db.query("select to_prepare from public.prep_list_lines")).rows[0].to_prepare), 160, "Not counted: full target");
  const sent = (await save(LEAD, lines(35, 150), true, draft.version + 1)).rows[0].r;
  assert.equal(Number((await db.query("select to_prepare from public.prep_list_lines")).rows[0].to_prepare), 150, "Override wins");
  assert.equal(sent.status, "sent");
  assert.equal((await as(PREP, "select count(*)::int n from public.prep_lists")).rows[0].n, 1, "Staff see the sent list");
  await assert.rejects(save(MGR, lines(1), false, 0, "2030-01-01"), /Invalid prep date/, "Far-future dates refused");
  await assert.rejects(save(MGR, JSON.stringify([{ item_id: item, target: -1, reserve: 0 }]), false, sent.version), /check/, "Negative target refused");

  // A shift leader who leaves (status not active) loses the right at once.
  await db.exec(`update public.users set status = 'inactive' where id = '${LEAD}'`);
  await assert.rejects(save(LEAD, lines(35), false, sent.version), /Prep planning access required/, "Inactive shift leader refused");
  await db.exec(`update public.users set status = 'active' where id = '${LEAD}'`);
  // Leftovers: managers + shift leaders only, today or the two days before, re-count overwrites.
  const today = (await db.query("select ((now() at time zone 'Europe/Berlin')::date)::text d")).rows[0].d;
  const count = (uid, qty, d = today) => as(uid, "select public.save_prep_leftovers($1, $2::date, $3::jsonb) n", [B, d, JSON.stringify([{ item_id: item, qty }])]);
  await assert.rejects(count(PREP, 10), /Prep planning access required/, "Staff without the switch cannot count");
  await count(LEAD, 30); await count(LEAD, 35);
  assert.equal(Number((await db.query("select qty from public.prep_leftovers")).rows[0].qty), 35, "Re-count overwrites tonight's leftover");
  await assert.rejects(count(LEAD, 5, "2030-01-01"), /Invalid count date/, "Future count dates refused");
  assert.equal((await as(PREP, "select count(*)::int n from public.prep_leftovers")).rows[0].n, 1, "Prep team can read leftovers");
  const notes = (await db.query("select user_id::text, message from public.notifications")).rows;
  assert.deepEqual(notes.map(n => n.user_id), [PREP], "Only that day's Preparation person is notified");
  assert.match(notes[0].message, /Chicken: 150 kg/);
  const seed = fs.readFileSync("scripts/ops/seed-stuttgart-prep-items.sql", "utf8");
  await db.exec(seed); await db.exec(seed);
  assert.equal((await db.query("select count(*)::int n from public.prep_items")).rows[0].n, 7, "Seed adds the page-7 items once; an existing active Chicken is not duplicated");
  assert.deepEqual((await db.query("select target_max::text t from public.prep_items where name = 'Kraut salad'")).rows[0].t, "{40,40,40,40,45,60,45}");
  console.log("Prep lists: managers + active shift leaders only, staff see sent lists only, target − leftover with override, stale-version and range guards, Preparation-roster notifications, leftover counts.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
