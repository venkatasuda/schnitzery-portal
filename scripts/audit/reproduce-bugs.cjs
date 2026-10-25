// Isolated audit probes: execute real source without database/network writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, expose = '', env = {}) {
  const source = fs.readFileSync(file, 'utf8') + expose;
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import ${name}`); }, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock-only', ...env } }, console, Intl, Date, Map, Set });
  return exports;
}

(async () => {
  const createdRoles = [];
  const session = { auth: { getUser: async () => ({ data: { user: { id: 'caller' } } }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'branch_owner', branch_id: 'branch' } }) }) }) }) };
  const admin = { auth: { admin: { createUser: async () => ({ data: { user: { id: 'created' } } }), deleteUser: async () => ({}) } }, from: () => ({ upsert: async row => { createdRoles.push(row.role); return {}; } }) };
  const rank = load('src/lib/auth/rank.ts', {});
  const route = load('src/app/api/create-staff/route.ts', { '@/lib/auth/rank': rank, '@/lib/activeBranch': {activeBranchFor:async()=> 'branch'}, '@/lib/supabase/server': { createClient: async () => session }, '@supabase/supabase-js': { createClient: () => admin }, 'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } } });
  const result = await route.POST({ json: async () => ({ email: 'audit@example.invalid', password: 'Audit-only!9876', role: 'super_admin', employee_code: 'AUDIT' }) });
  assert.equal(result.status, 403);
  assert.deepEqual(createdRoles, []);
  const actions = fs.readFileSync('src/lib/push/actions.ts', 'utf8');
  assert.ok(!actions.includes('export async function sendPushToUser'));
  assert.ok(fs.readFileSync('src/lib/push/delivery.ts', 'utf8').includes('import "server-only"'));
  const payroll = load('src/lib/pay/calculations.ts', {});
  assert.equal(payroll.payForMinutes(61, 15), 15.25);
  assert.equal(payroll.classifyShift('2026-03-28T23:00:00Z', '2026-03-29T05:00:00Z', new Set(), 1320, 360).nightMin, 300);
  console.log('Account escalation, push action exposure, exact pay and DST regression checks pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });
