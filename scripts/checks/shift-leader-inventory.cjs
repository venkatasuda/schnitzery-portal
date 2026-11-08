// Shift leaders (migration 20261108150000) on top of the real inventory migrations: count drafts but
// never publish, direct deliveries only without cost, missing expiry dates; plain staff stay refused.
const assert = require('node:assert/strict'), fs = require('node:fs');
const check = require('./receiving-batches.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
check(async db => {
  const a = id(1), manager = id(3), staff = id(4), product = id(6), lead = id(90);
  await db.exec(`reset role;
    update users set status='active';
    alter table inventory_counts add column if not exists created_at timestamptz default now(), add column if not exists count_date date default current_date;
    insert into users values ('${lead}','${a}','staff','active','Shift Lead');
    create table public.shift_leaders(branch_id uuid, user_id uuid, primary key(branch_id, user_id));
    create or replace function private.is_shift_leader(p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$
      select auth.uid() is not null and exists (select 1 from public.shift_leaders s join public.users u on u.id = s.user_id where s.branch_id = p_branch and s.user_id = auth.uid() and u.status = 'active') $$;
    grant execute on function private.is_shift_leader(uuid) to authenticated;
    insert into public.shift_leaders values ('${a}','${lead}');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261024034605_inventory_count_sessions.sql', 'utf8'));
  const migration = fs.readFileSync('supabase/migrations/20261108150000_shift_leader_inventory.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); // re-run is a no-op
  const login = who => db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${who}',false)`);
  const count = (action, sid, rev = 0, lines = []) => db.query('select public.edit_inventory_count($1,$2,$3,$4,$5) r', [a, sid, action, rev, JSON.stringify(lines)]);
  const op = (cmd, action, body) => db.query('select public.inventory_operation($1,$2,$3,$4) r', [a, id(cmd), action, JSON.stringify(body)]);
  const lot = { qty: 1, expiry: '2026-12-01', lot: 'SL', expiry_note: '' };
  const delivery = (invoice, cost) => ({ supplier: 'Metro', invoice, received_date: '2020-01-03', note: '', lines: [{ product_id: product, accepted: 1, rejected: 0, cost, note: '', batches: [lot] }] });

  // Stocktake: shift leader starts, reads and saves; publishing is refused; plain staff refused.
  await login(lead);
  const sid = id(91);
  const started = (await count('start', sid)).rows[0].r;
  assert.equal((await db.query('select count(*)::int n from inventory_count_sessions')).rows[0].n, 1, 'Shift leader reads the draft');
  const lineIds = (await db.query('select id from inventory_count_lines where session_id=$1', [started.id])).rows.map(r => r.id);
  const line = lineIds[0];
  const saved = (await count('save', started.id, started.revision, lineIds.map(id => ({ id, quantity: 3 })))).rows[0].r;
  await assert.rejects(count('complete', started.id, saved.revision), /Count access denied/, 'Shift leader cannot publish a count');
  await login(staff);
  await assert.rejects(count('save', started.id, saved.revision, [{ id: line, quantity: 4 }]), /Count access denied/, 'Plain staff cannot count');
  assert.equal((await db.query('select count(*)::int n from inventory_count_sessions')).rows[0].n, 0, 'Plain staff cannot read drafts');
  await login(manager);
  assert.equal((await count('complete', started.id, saved.revision)).rows[0].r.status, 'completed', 'Manager publishes');

  // Deliveries: shift leader without cost only; other operations refused.
  await login(lead);
  await op(95, 'receive_direct', delivery('SL-1', null));
  await assert.rejects(op(96, 'receive_direct', delivery('SL-2', 12.5)), /Inventory access denied/, 'Shift leader cannot enter a cost');
  await assert.rejects(op(97, 'supplier_save', { name: 'X', email: '', lead_days: 1, is_active: true }), /Inventory access denied/, 'Shift leader cannot edit suppliers');
  await login(staff);
  await assert.rejects(op(98, 'receive_direct', delivery('ST-1', null)), /Inventory access denied/, 'Plain staff cannot receive');
  await login(lead);
  assert.deepEqual((await db.query('select public.shift_supplier_names($1) n', [a])).rows.map(r => r.n), ['Metro'], 'Supplier names for shift leaders');
  await login(staff);
  assert.equal((await db.query('select public.shift_supplier_names($1) n', [a])).rows.length, 0, 'No supplier names for plain staff');

  // Missing expiry date: shift leader may fill it.
  await login(manager);
  await op(99, 'receive_direct', { ...delivery('NO-DATE', null), lines: [{ product_id: product, accepted: 1, rejected: 0, cost: null, note: '', batches: [{ qty: 1, expiry: null, lot: '', expiry_note: 'No date printed on packaging' }] }] });
  const undated = (await db.query("select id from stock_batches where expiry_date is null and status='active' limit 1")).rows[0]?.id;
  assert.ok(undated, 'Undated batch created');
  {
    await login(lead);
    await db.query('select public.resolve_stock_batch_expiry($1,$2,$3,$4,$5)', [a, undated, id(100), '2026-12-24', 'Date found on the label']);
    await login(staff);
    await assert.rejects(db.query('select public.resolve_stock_batch_expiry($1,$2,$3,$4,$5)', [a, undated, id(101), '2026-12-25', 'Another date']), /Manager batch access required/, 'Plain staff cannot set expiry');
  }
  await db.exec('reset role');
  console.log('Shift leader inventory: counts saved not published, cost-free direct deliveries only, expiry dates, supplier names; plain staff refused.');
}).catch(error => { console.error(error); process.exitCode = 1; });
