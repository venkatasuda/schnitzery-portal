// Speed migration: inventory_latest_counts / inventory_price_baseline return the same
// answers as reading the full history, and obey the caller's RLS.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { PGlite } = require('../../.audit-db/node_modules/@electric-sql/pglite');
const load = f => { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: 1, target: 7 } }).outputText, { exports, require: () => ({}), Number, Set, Array, Object, JSON, Math }); return exports; };
const { latestPrice } = load('src/lib/analytics/coverage.ts');
const X = '00000000-0000-0000-0000-000000000010', Y = '00000000-0000-0000-0000-000000000011', mX = '00000000-0000-0000-0000-000000000001';
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table users(id uuid primary key, branch_id uuid);
    create function accessible_branch_ids() returns setof uuid language sql security definer set search_path=public as $$select branch_id from users where id=auth.uid()$$;
    create table inventory_counts(id uuid primary key default gen_random_uuid(), branch_id uuid, count_date date not null, category text, product text, ist numeric, unit text, created_at timestamptz);
    create table inventory_purchases(id uuid primary key default gen_random_uuid(), branch_id uuid not null, category text, product text not null, qty numeric not null, unit text, cost numeric not null, purchase_date date not null);
    alter table inventory_counts enable row level security; alter table inventory_purchases enable row level security;
    create policy r on inventory_counts for select using (branch_id in (select accessible_branch_ids()));
    create policy r on inventory_purchases for select using (branch_id in (select accessible_branch_ids()));
    grant select on users, inventory_counts, inventory_purchases to authenticated;
    insert into users values('${mX}','${X}');
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261022150000_inventory_report_summaries.sql', 'utf8'));

  // Random history: 6 products × units with case/space variants, zero/negative/odd rows.
  let seed = 7; const rnd = n => (seed = (seed * 48271) % 2147483647) % n;
  const prods = [['Dry', 'Oil', 'l'], ['Dry', 'Oil', ' L '], ['Meat', 'Pork', 'kg'], [null, 'Salt', null], ['Veg', 'Onion', 'kg'], ['Veg', 'Leek', 'stk']];
  const day = i => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < 400; i++) {
    const [c, p, u] = prods[rnd(prods.length)], b = rnd(5) ? X : Y;
    await db.query('insert into inventory_purchases(branch_id,category,product,qty,unit,cost,purchase_date) values($1,$2,$3,$4,$5,$6,$7)', [b, c, p, [0, -1, 2, 5, 10][rnd(5)], u, [-3, 0, 12.5, 40, 7][rnd(5)], day(rnd(600))]);
    await db.query('insert into inventory_counts(branch_id,category,product,ist,unit,count_date,created_at) values($1,$2,$3,$4,$5,$6,$7)', [b, c, p, rnd(9) ? rnd(30) : null, u, day(rnd(600)), rnd(6) ? `2025-06-01T0${rnd(9)}:00:00Z` : null]);
  }
  const all = (await db.query(`select * from inventory_purchases where branch_id=$1`, [X])).rows.map(r => ({ ...r, purchase_date: r.purchase_date.toISOString().slice(0, 10) }));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${mX}',false)`);
  const key = r => JSON.stringify([r.category || '', r.product, (r.unit || '').trim().toLowerCase()]);
  for (const cutoff of ['2025-03-01', '2025-09-15', '2026-05-01']) {
    const base = (await db.query('select * from inventory_price_baseline($1,$2)', [X, cutoff])).rows.map(r => ({ ...r, purchase_date: r.purchase_date.toISOString().slice(0, 10) }));
    const fast = [...base, ...all.filter(p => p.purchase_date >= cutoff)];
    for (const k of new Set(all.map(key))) for (const d of [cutoff, day(300), day(599)]) if (d >= cutoff)
      assert.equal(latestPrice(fast.filter(p => key(p) === k), d), latestPrice(all.filter(p => key(p) === k), d), `price ${k} on ${d}, cutoff ${cutoff}`);
  }
  // Latest count = what the old ascending read kept last (Postgres sorts NULL created_at last).
  const asc = (await db.query(`select * from inventory_counts where branch_id=$1 order by count_date, created_at, id`, [X])).rows;
  const want = {}; for (const c of asc) want[JSON.stringify([c.category || '', c.product, c.unit || ''])] = c.ist == null ? null : Number(c.ist);
  const got = {}; for (const c of (await db.query('select * from inventory_latest_counts($1)', [X])).rows) got[JSON.stringify([c.category || '', c.product, c.unit || ''])] = c.ist == null ? null : Number(c.ist);
  assert.deepEqual(got, want, 'Latest count per identity');
  // RLS: another branch's rows are invisible through the functions.
  assert.equal((await db.query('select * from inventory_latest_counts($1)', [Y])).rows.length, 0);
  assert.equal((await db.query('select * from inventory_price_baseline($1,$2)', [Y, '2030-01-01'])).rows.length, 0);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from inventory_latest_counts($1)', [X]), undefined, 'anon cannot call');
  console.log('Inventory summaries: same prices and latest counts as full history, RLS-scoped.');
})().catch(e => { console.error(e); process.exitCode = 1; });
