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
    create table public.users(id uuid primary key, role text, branch_id uuid, full_name text, status text default 'active', team text, skills text[], contract_type text);
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
  const g = fs.readFileSync("supabase/migrations/20261112100000_audit_guards.sql", "utf8"); await db.exec(g); await db.exec(g); // publish checks the exact draft + membership; own team fields
  const as = async (uid, sql, p) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql, p); } finally { await db.exec("reset role;"); } };
  const W = "2026-11-16", draft = JSON.stringify({ Monday: [{ user_id: ANA, name: "Ana", team: "Kitchen", shift: "Morning" }] });

  await as(MGR, "insert into public.roster_drafts(branch_id, week_start, roster_data, base_data) values ($1, $2, $3::jsonb, null)", [B, W, draft]);
  assert.equal((await as(ANA, "select count(*)::int n from public.roster_drafts")).rows[0].n, 0, "Staff cannot see drafts");
  assert.equal((await as(OTHER, "select count(*)::int n from public.roster_drafts")).rows[0].n, 0, "Other branch's manager cannot see drafts");
  await assert.rejects(as(ANA, "insert into public.staff_tiers(user_id, branch_id, tier) values ($1, $2, 1)", [ANA, B]), /row-level security/, "Staff cannot set tiers");
  await as(MGR, "insert into public.staff_tiers(user_id, branch_id, tier) values ($1, $2, 1)", [ANA, B]);
  assert.equal((await as(ANA, "select count(*)::int n from public.staff_tiers")).rows[0].n, 0, "Staff cannot read tiers");
  await assert.rejects(as(ANA, "select public.publish_roster($1, $2::date, $3::jsonb)", [B, W, draft]), /Managers only/);
  await assert.rejects(as(OTHER, "select public.publish_roster($1, $2::date, $3::jsonb)", [B, W, draft]), /Managers only/, "Other branch refused");

  // Live roster changed after the draft started (e.g. approved cover) → refused, draft kept.
  await db.query("insert into public.weekly_roster(branch_id, week_start, roster_data) values ($1, $2, '{}'::jsonb)", [B, W]);
  await assert.rejects(as(MGR, "select public.publish_roster($1, $2::date, $3::jsonb)", [B, W, draft]), /Roster changed since this draft/);
  await db.query("update public.roster_drafts set base_data = '{}'::jsonb");

  // The database publishes only the draft that was checked, and only branch members (audit 12 Nov).
  await assert.rejects(as(MGR, "select public.publish_roster($1, $2::date, $3::jsonb)", [B, W, "{}"]), /Draft changed since it was checked/);
  const foreign = JSON.stringify({ Monday: [{ user_id: OTHER, name: "Otto", team: "Kitchen", shift: "Morning" }] });
  await db.query("update public.roster_drafts set roster_data = $1::jsonb", [foreign]);
  await assert.rejects(as(MGR, "select public.publish_roster($1, $2::date, $3::jsonb)", [B, W, foreign]), /Roster staff must be active in this branch/);
  await db.query("update public.roster_drafts set roster_data = $1::jsonb", [draft]);
  assert.equal((await as(MGR, "select public.publish_roster($1, $2::date, $3::jsonb) n", [B, W, draft])).rows[0].n, 1, "Ana notified");
  // Staff cannot change their own team, team skills or contract type directly; other skills stay theirs.
  await db.exec("grant update on public.users to authenticated;");
  await as(ANA, "update public.users set skills = '{Barista}' where id = $1", [ANA]);
  await assert.rejects(as(ANA, "update public.users set skills = '{Barista,Kasse}' where id = $1", [ANA]), /set by your manager/);
  await assert.rejects(as(ANA, "update public.users set team = 'Cashier' where id = $1", [ANA]), /set by your manager/);
  await assert.rejects(as(ANA, "update public.users set contract_type = 'Full time' where id = $1", [ANA]), /own contract type/);
  await as(MGR, "update public.users set skills = '{Barista,Kasse}', team = 'Kitchen' where id = $1", [ANA]);
  assert.deepEqual((await db.query("select roster_data from public.weekly_roster where week_start = $1", [W])).rows[0].roster_data, JSON.parse(draft), "Draft is live");
  assert.equal((await db.query("select count(*)::int n from public.roster_drafts")).rows[0].n, 0, "Draft removed after publishing");
  assert.equal((await db.query("select count(*)::int n from public.notifications where user_id = $1 and type = 'roster'", [ANA])).rows[0].n, 1);
  await assert.rejects(as(MGR, "select public.publish_roster($1, $2::date, $3::jsonb)", [B, W, draft]), /No draft to publish/);
  // Staffing targets (migration 20261111140000): managers of the branch only.
  await db.exec(fs.readFileSync("supabase/migrations/20261111140000_staffing_targets.sql", "utf8"));
  await as(MGR, "insert into public.staffing_targets(branch_id, weekday, team, shift, needed) values ($1, 4, 'Kitchen', 'Night', 4)", [B]);
  assert.equal((await as(ANA, "select count(*)::int n from public.staffing_targets")).rows[0].n, 0, "Staff cannot read staffing targets");
  await assert.rejects(as(OTHER, "insert into public.staffing_targets(branch_id, weekday, team, shift, needed) values ($1, 4, 'Kitchen', 'Night', 9)", [B]), /row-level security/, "Other branch cannot write");
  await assert.rejects(as(MGR, "insert into public.staffing_targets(branch_id, weekday, team, shift, needed) values ($1, 7, 'Kitchen', 'Night', 1)", [B]), /check constraint/, "Weekday 0–6 only");
  // Standing availability (migration 20261111170000): own row, or a manager of that branch.
  await db.exec(fs.readFileSync("supabase/migrations/20261111170000_availability_defaults.sql", "utf8"));
  await db.query("insert into public.users values ('00000000-0000-0000-0000-000000000005', 'staff', $1, 'Ben')", [B]);
  await as(ANA, "insert into public.availability_defaults(user_id, branch_id, days) values ($1, $2, '{\"Tuesday\": [\"Morning\"]}')", [ANA, B]);
  await assert.rejects(as(ANA, "insert into public.availability_defaults(user_id, branch_id, days) values ('00000000-0000-0000-0000-000000000005', $1, '{}')", [B]), /row-level security/, "Cannot set a colleague's pattern");
  assert.equal((await as("00000000-0000-0000-0000-000000000005", "select count(*)::int n from public.availability_defaults")).rows[0].n, 0, "Colleagues cannot read it");
  assert.equal((await as(MGR, "select count(*)::int n from public.availability_defaults")).rows[0].n, 1, "The branch manager can");
  assert.equal((await as(OTHER, "select count(*)::int n from public.availability_defaults")).rows[0].n, 0, "Other branches cannot");
  // Delivery-note read limit (migration 20261111180000): managers + shift leaders, 40 a day.
  await db.exec("create table public.shift_leaders(branch_id uuid, user_id uuid); alter table public.users add column if not exists status text default 'active';");
  await db.exec(fs.readFileSync("supabase/migrations/20261111180000_delivery_note_limit.sql", "utf8"));
  assert.equal((await as(ANA, "select public.allow_note_read() ok")).rows[0].ok, false, "Plain staff may not read notes");
  await db.query("insert into public.shift_leaders values ($1, $2)", [B, ANA]);
  assert.equal((await as(ANA, "select public.allow_note_read() ok")).rows[0].ok, true, "A shift leader may");
  await db.query("update public.note_read_limits set requests = 40");
  assert.equal((await as(ANA, "select public.allow_note_read() ok")).rows[0].ok, false, "41st read of the day is refused");
  assert.equal((await as(MGR, "select public.allow_note_read() ok")).rows[0].ok, true, "Limit is per person");
  console.log("Roster publish: drafts/tiers manager-only, publish copies draft live, stale drafts refused, staff notified; staffing targets manager-only; standing availability own/manager.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
