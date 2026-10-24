const assert = require('node:assert/strict');
const AB={activeBranchFor:async(_db,p)=>p?.branch_id??null,accessibleBranchIds:async()=>[]}; // multi-branch resolver stub: home branch
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let role = 'staff', reads = 0;
const client = { auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, from(table) {
  assert.equal(table, 'users', 'Denied or invalid requests must not read or write payroll tables');
  reads++;
  const q = { select: () => q, eq: () => q, single: async () => ({ data: { role, branch_id: 'branch' } }) };
  return q;
} };
const exportsObject = {};
const imports = {
  '@supabase/supabase-js': {},
  '@/lib/supabase/server': { createClient: async () => client },
  '@/lib/activeBranch': AB,
  '@/lib/supabase/readAll': {}, '@/lib/pay/wages': {}, '@/lib/pay/calculations': {},
  '@/lib/time/berlinDate': { berlinMonth: () => '2026-10', monthRange: month => {
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Invalid month');
    return { from: month + '-01', next: '2026-11-01' };
  } },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/queries/payroll.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { exports: exportsObject, require: name => imports[name], Date, Set });
(async () => {
  for (const request of [() => exportsObject.getPayrollSettings(), () => exportsObject.getPayrollRun('2026-10'), () => exportsObject.setPayrollApproval('2026-10', true), () => exportsObject.getPayrollSummary('2026-10')]) {
    assert.equal((await request()).error, 'Managers only.');
  }
  role = 'manager';
  assert.equal((await exportsObject.getPayrollRun('2026-13')).error, 'Invalid month.');
  assert.equal((await exportsObject.getPayrollSummary('2026-13')).error, 'Invalid month.');
  assert.equal((await exportsObject.setPayrollApproval('2026-13', true)).error, 'Invalid month.');
  assert.equal((await exportsObject.setPayrollApproval('2026-10', 'true')).error, 'Invalid approval request.');
  assert.equal((await exportsObject.setPayrollApproval('2026-10', true, 'x'.repeat(2001))).error, 'Invalid approval request.');
  assert.equal(reads, 9);
  console.log('Payroll role and input boundaries pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });
