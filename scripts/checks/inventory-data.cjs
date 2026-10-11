const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const key = item => JSON.stringify([item.category || '', item.product, item.unit || '']);
const master = (product, category) => ({ product, category, unit: 'L', soll: 50, branch_id: 'branch', is_active: true });
const count = (product, category, date, ist, id) => ({ ...master(product, category), count_date: date, ist, id, created_at: `${date}T12:00:00Z` });
let failure = null, writes = 0;
const tables = {
  users: [{ id: 'manager', full_name: 'Manager', role: 'manager', branch_id: 'branch' }],
  inventory_master: [master('Milk', 'Dairy'), master('Milk', 'Drinks'), master('Old stock', 'Dairy')],
  inventory_counts: [count('Milk', 'Dairy', '2026-10-09', 20, 'a'), count('Milk', 'Dairy', '2026-10-11', 10, 'b'),
    count('Milk', 'Dairy', '2026-10-11', 8, 'c'), count('Milk', 'Drinks', '2026-10-09', 100, 'd'),
    count('Milk', 'Drinks', '2026-10-11', 80, 'e'), count('Old stock', 'Dairy', '2026-10-07', 10, 'f'),
    count('Old stock', 'Dairy', '2026-10-08', 5, 'g')],
  inventory_purchases: [],
};
const sb = {
  auth: { getUser: async () => ({ data: { user: { id: 'manager' } } }) },
  from(table) {
    const filters = [], sorts = []; let from = 0, to = Infinity;
    const result = () => {
      if (failure === table) return { data: null, error: { message: 'Unavailable' } };
      const rows = (tables[table] || []).filter(row => filters.every(test => test(row)));
      rows.sort((a, b) => { for (const [column, direction] of sorts) {
        if (a[column] !== b[column]) return (a[column] < b[column] ? -1 : 1) * direction;
      } return 0; });
      return { data: rows.slice(from, to + 1), error: null };
    };
    const query = {
      range: (start, end) => { from = start; to = end; return query; },
      select: () => query,
      eq: (col, value) => { filters.push(row => row[col] === value); return query; },
      gte: (col, value) => { filters.push(row => row[col] >= value); return query; },
      lte: (col, value) => { filters.push(row => row[col] <= value); return query; },
      order: (col, opts = {}) => { sorts.push([col, opts.ascending === false ? -1 : 1]); return query; },
      single: async () => ({ ...result(), data: result().data?.[0] || null }),
      insert: async () => { writes++; return { error: null }; },
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  },
};
const allRows = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/supabase/readAll.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: allRows });
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/queries/inventory.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject, Date, Set, Map, console, require(name) {
  if (name === "@/lib/supabase/readAll") return allRows;
  if (name === '@/lib/supabase/server') return { createClient: async () => sb };
  if (name === '@/lib/time/berlinDate') return { berlinToday: () => '2026-10-11', berlinMonth: () => '2026-10', isCalendarDate: date => /^\d{4}-\d{2}-\d{2}$/.test(date) };
  if (name === '@/lib/inventory/identity') return { inventoryKey: key, validInventoryItem: item => typeof item.product === "string" && item.product.length > 0 };
  if (name === '@/lib/push/delivery') return {};
  throw new Error(`Unexpected import ${name}`);
} });
(async () => {
  const counts = await exportsObject.getCounts();
  assert.equal(counts.counts.length, 2);
  assert.equal(counts.counts.find(row => row.category === 'Dairy').ist, 8);
  const forecast = await exportsObject.getDepletionForecast();
  assert.equal(forecast.items.find(row => row.category === 'Dairy' && row.product === 'Milk').usageRate, 6);
  assert.equal(forecast.items.find(row => row.category === 'Drinks').usageRate, 10);
  assert.equal(forecast.items.find(row => row.product === 'Old stock').suggested, 0);
  assert.equal(forecast.items.find(row => row.product === 'Old stock').stale, true);
  assert.equal((await exportsObject.saveCount('Milk', 'Dairy', -1, 50, 'L')).ok, false);
  assert.equal((await exportsObject.addDelivery({ product: 'Milk', category: 'Dairy', qty: Infinity, cost: 1, unit: 'L' })).ok, false);
  assert.equal(writes, 0);
  failure = 'inventory_counts';
  assert.equal((await exportsObject.getOrderAlert()).ok, false);
  assert.equal((await exportsObject.getDepletionForecast()).ok, false);
  console.log('Distinct stock identities, deterministic counts, measured forecast, stale data and invalid-write checks pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });
