// Owner targets (migration 20261023160000): owners set targets for branches they can
// access; managers read but cannot change them; other branches stay invisible.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");

const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
const ownerA = "00000000-0000-0000-0000-000000000001", mgrA = "00000000-0000-0000-0000-000000000002", ownerB = "00000000-0000-0000-0000-000000000003";

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key);
    create table users(id uuid primary key, branch_id uuid, role text);
    create function public.accessible_branch_ids() returns setof uuid language sql stable security definer as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.is_owner() returns boolean language sql stable security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role in ('branch_owner','brand_owner','super_admin')) $$;
    grant usage on schema public to authenticated;
    insert into branches values ('${A}'),('${B}');
    insert into users values ('${ownerA}','${A}','branch_owner'),('${mgrA}','${A}','manager'),('${ownerB}','${B}','branch_owner');
  `);
  await db.exec(fs.readFileSync("supabase/migrations/20261023160000_branch_targets.sql", "utf8"));
  const as = async (uid, sql, params = []) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`); try { return await db.query(sql, params); } finally { await db.exec("reset role"); } };
  const upsert = "insert into branch_targets(branch_id, labour_pct, prime_pct, updated_by) values ($1, $2, 60, $3) on conflict (branch_id) do update set labour_pct = excluded.labour_pct, updated_by = excluded.updated_by";

  await as(ownerA, upsert, [A, 30, ownerA]);
  await as(ownerA, upsert, [A, 28, ownerA]);
  assert.equal((await as(mgrA, "select labour_pct from branch_targets")).rows[0].labour_pct, "28", "Manager reads own branch targets");
  await assert.rejects(as(mgrA, upsert, [A, 50, mgrA]), /row-level security/, "Managers cannot change targets");
  await assert.rejects(as(ownerB, upsert, [A, 50, ownerB]), /row-level security/, "Owner of another branch cannot write");
  assert.equal((await as(ownerB, "select * from branch_targets")).rows.length, 0, "Other branch's targets stay invisible");
  await assert.rejects(as(ownerA, upsert, [A, 50, ownerB]), /row-level security/, "updated_by must be the caller");
  await assert.rejects(as(ownerA, upsert, [A, 0, ownerA]), /check constraint/, "0% is not a target");
  console.log("Branch targets: owners set, managers read, other branches invisible, values validated.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
