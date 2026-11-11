// Roster drafts + publish (migration 20261111120000): drafts and tiers are manager-only, publishing copies the
// draft live, refuses when the live roster changed meanwhile, and notifies everyone on the published roster.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", MGR = "00000000-0000-0000-0000-000000000001", ANA = "00000000-0000-0000-0000-000000000002", OTHER = "00000000-0000-0000-0000-000000000009";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table public.branches(id uuid primary key, name text);
    create table public.users(id uuid primary key, role text, branch_id uuid, full_name text);
    create table public.weekly_roster(id uuid primary key default gen_random_uuid(), branch_id uuid, week_start date, roster_data jsonb, unique(branch_id, week_start));
    create table public.notifications(user_id uuid, branch_id uuid, type text, title text, message text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_manager() returns boolean language sql security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role <> 'staff') $$;
    create function public.accessible_branch_ids() returns setof uuid language sql security definer as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval default '12:00:00') returns void language sql as $$ insert into public.notifications values (p_user, p_branch, p_type, p_title, p_message) $$;
    insert into public.branches values ('${B}', 'Stuttgart'), ('${OTHER}', 'Munich');
    insert into public.users values ('${MGR}', 'manager', '${B}', 'Mia'), ('${ANA}', 'staff', '${B}', 'Ana'), ('${OTHER}', 'manager', '${OTHER}', 'Otto');
    grant usage on schema public, auth, private to authenticated; grant select, insert, update on public.weekly_roster to authenticated; grant select on public.users to authenticated;
    grant execute on all functions in schema public, auth to authenticated;`);
  const m = fs.readFileSync("supabase/migrations/20261111120000_roster_publish.sql", "utf8"); await db.exec(m); await db.exec(m);
  const as = async (uid, sql, p) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql, p); } finally { await db.exec("reset role;"); } };
  const W = "2026-11-16", draft = JSON.stringify({ Monday: [{ user_id: ANA, name: "Ana", team: "Kitchen", shift: "Morning" }] });

  await as(MGR, "insert into public.roster_drafts(branch_id, week_start, roster_data, base_data) values ($1, $2, $3::jsonb, null)", [B, W, draft]);
  assert.equal((await as(ANA, "select count(*)::int n from public.roster_drafts")).rows[0].n, 0, "Staff cannot see drafts");
  assert.equal((await as(OTHER, "select count(*)::int n from public.roster_drafts")).rows[0].n, 0, "Other branch's manager cannot see drafts");
  await assert.rejects(as(ANA, "insert into public.staff_tiers(user_id, branch_id, tier) values ($1, $2, 1)", [ANA, B]), /row-level security/, "Staff cannot set tiers");
  await as(MGR, "insert into public.staff_tiers(user_id, branch_id, tier) values ($1, $2, 1)", [ANA, B]);
  assert.equal((await as(ANA, "select count(*)::int n from public.staff_tiers")).rows[0].n, 0, "Staff cannot read tiers");
  await assert.rejects(as(ANA, "select public.publish_roster($1, $2::date)", [B, W]), /Managers only/);
  await assert.rejects(as(OTHER, "select public.publish_roster($1, $2::date)", [B, W]), /Managers only/, "Other branch refused");

  // Live roster changed after the draft started (e.g. approved cover) → refused, draft kept.
  await db.query("insert into public.weekly_roster(branch_id, week_start, roster_data) values ($1, $2, '{}'::jsonb)", [B, W]);
  await assert.rejects(as(MGR, "select public.publish_roster($1, $2::date)", [B, W]), /Roster changed since this draft/);
  await db.query("update public.roster_drafts set base_data = '{}'::jsonb");

  assert.equal((await as(MGR, "select public.publish_roster($1, $2::date) n", [B, W])).rows[0].n, 1, "Ana notified");
  assert.deepEqual((await db.query("select roster_data from public.weekly_roster where week_start = $1", [W])).rows[0].roster_data, JSON.parse(draft), "Draft is live");
  assert.equal((await db.query("select count(*)::int n from public.roster_drafts")).rows[0].n, 0, "Draft removed after publishing");
  assert.equal((await db.query("select count(*)::int n from public.notifications where user_id = $1 and type = 'roster'", [ANA])).rows[0].n, 1);
  await assert.rejects(as(MGR, "select public.publish_roster($1, $2::date)", [B, W]), /No draft to publish/);
  console.log("Roster publish: drafts/tiers manager-only, publish copies draft live, stale drafts refused, staff notified.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
