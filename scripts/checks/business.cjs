const assert = require('node:assert/strict');
const AB={activeBranchFor:async(_db,p)=>p?.branch_id??null,accessibleBranchIds:async()=>[]}; // multi-branch resolver stub: home branch
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, Date, Intl, Set, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; } });
  return exports;
}
let role = 'manager', failure;
const tables = {
  users: [{ id: 'manager', role: 'manager', branch_id: 'branch', team: 'Kitchen' }, { id: 'unpriced', branch_id: 'branch' }],
  branches: [{ id: 'branch', name: 'Test branch' }],
  daily_sales: [{ branch_id: 'branch', sale_date: '2026-10-11', amount: 100 }],
  inventory_purchases: [{ branch_id: 'branch', purchase_date: '2026-10-11', cost: 30 }],
  waste_log: [{ branch_id: 'branch', work_date: '2026-10-11', qty: 2, unit: 'kg' }],
  attendance_logs: [{ user_id: 'manager', branch_id: 'branch', work_date: '2026-10-11', duration_mins: 15 }, { user_id: 'unpriced', branch_id: 'branch', work_date: '2026-10-11', duration_mins: 60 }],
};
const sb = { auth: { getUser: async () => ({ data: { user: { id: 'manager' } } }) }, from(table) {
  const filters = [];
  const q = { select: () => q, order: () => q, range: () => q,
    eq: (k, v) => { filters.push(r => r[k] === v); return q; },
    in: (k, v) => { filters.push(r => v.includes(r[k])); return q; },
    gte: (k, v) => { filters.push(r => r[k] >= v); return q; },
    lte: (k, v) => { filters.push(r => r[k] <= v); return q; },
    single: async () => ({ data: { role, branch_id: 'branch' }, error: null }),
    then: (resolve, reject) => Promise.resolve({ data: (tables[table] || []).filter(r => filters.every(f => f(r))), error: failure === table ? { message: 'Unavailable' } : null }).then(resolve, reject),
  }; return q;
} };
const api = load('src/lib/queries/branch-analytics.ts', {
  '@/lib/supabase/server': { createClient: async () => sb },
  '@/lib/activeBranch': AB,
  '@/lib/supabase/readAll': { readAll: async q => await q },
  '@/lib/time/berlinDate': { berlinToday: () => '2026-10-11', isCalendarDate: d => /^2026-10-\d\d$/.test(d) },
  '@/lib/queries/schedule-constants': { DAYS: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], SHIFT_MODEL: {} },
  '@/lib/pay/calculations': { shiftMinutes: l => ({ paidMin: l.duration_mins }) },
  '@/lib/pay/wages': { wageMapForBranches: async () => ({ manager: 20 }) },
  '@/lib/analytics/coverage': load('src/lib/analytics/coverage.ts'),
});
(async () => {
  const r = await api.getBranchAnalytics({ period: 'weekly' });
  assert.equal(r.ok, true);
  assert.equal(r.business.purchaseSpend, 30);
  assert.equal(r.metrics.laborCost, 5);
  assert.equal(r.metrics.salesPerLaborHour, 80);
  assert.equal(r.business.missingWageStaff, 1);
  assert.equal(r.metrics.laborCostPct, null);
  assert.equal(r.business.salesDays, 1);
  assert.equal(r.business.elapsedDays, 7);
  assert.equal(r.business.salesTrend[0].recorded, false);
  assert.deepEqual({ ...r.business.coverage.labor.missing }, { wages: 1 }, 'Labour cost is a lower bound, not complete');
  assert.equal(r.business.coverage.sales.complete, true, 'Every open day has sales');
  assert.equal(r.business.purchasePct, 30);
  // Release D: an open day without sales and a delivery without cost are missing, not zero.
  tables.attendance_logs.push({ user_id: 'manager', branch_id: 'branch', work_date: '2026-10-10', duration_mins: 60 });
  tables.inventory_purchases.push({ branch_id: 'branch', purchase_date: '2026-10-10', cost: null });
  const gap = await api.getBranchAnalytics({ period: 'weekly' });
  assert.equal(gap.business.purchaseSpend, 30);
  assert.deepEqual({ ...gap.business.coverage.spend.missing }, { costs: 1 });
  assert.deepEqual({ ...gap.business.coverage.sales.missing }, { salesDays: 1 });
  assert.equal(gap.metrics.salesPerLaborHour, null);
  assert.equal(gap.business.purchasePct, null);
  tables.attendance_logs.pop(); tables.inventory_purchases.pop();
  // Review finding 9: future-dated records are not current actuals (today = 2026-10-11).
  tables.daily_sales.push({ branch_id: 'branch', sale_date: '2026-10-20', amount: 1000 });
  tables.inventory_purchases.push({ branch_id: 'branch', purchase_date: '2026-10-20', cost: 300 });
  const future = await api.getBranchAnalytics({ period: 'monthly', date: '2026-10-11' });
  assert.equal(future.metrics.totalSales, 100); assert.equal(future.business.purchaseSpend, 30);
  tables.daily_sales.pop(); tables.inventory_purchases.pop();
  failure = 'inventory_purchases';
  assert.equal((await api.getBranchAnalytics()).ok, false);
  failure = null; role = 'staff';
  assert.equal((await api.getBranchAnalytics()).ok, false);
  const validation = load('src/lib/agent/validation.ts');
  validation.validateToolInput('get_business_performance', { period: 'monthly' });
  assert.throws(() => validation.validateToolInput('get_business_performance', { period: 'monthly', branchId: 'other' }));
  assert.throws(() => validation.validateToolInput('get_business_performance', { period: 'yearly' }));
  console.log('Business totals, exact productivity, missing sales days/costs, incomplete wages, sales gaps, role denial and AI tool validation pass.');
})().catch(e => { console.error(e); process.exitCode = 1; });
