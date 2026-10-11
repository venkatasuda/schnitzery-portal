const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
let instant;
class BusinessClock extends Date {
  constructor(...args) { super(...(args.length ? args : [instant])); }
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/time/berlinDate.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsForTest, Date: BusinessClock, Intl });
for (const [utc, day, month] of [
  ['2026-03-31T22:30:00Z', '2026-04-01', '2026-04'],
  ['2026-10-11T22:30:00Z', '2026-10-12', '2026-10'],
  ['2026-10-31T23:30:00Z', '2026-11-01', '2026-11'],
]) {
  instant = utc;
  assert.equal(exportsForTest.berlinToday(), day);
  assert.equal(exportsForTest.berlinMonth(), month);
}
for (const route of ['attendance-hub', 'ops', 'labor', 'export', 'noshow', 'inventory']) {
  const source = fs.readFileSync(`src/app/(app)/${route}/page.tsx`, 'utf8');
  assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, (?:7|10)\)/, `${route} defaults to a UTC calendar date`);
}
console.log('UI business dates remain correct after Berlin midnight in summer, winter and at month boundaries.');
