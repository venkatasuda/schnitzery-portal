// Pure audit regression: no database or network access. Expected to fail until ENG2 is fixed.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const originalLoad = Module._load;
Module._load = function(id, parent, main) {
  return originalLoad.call(this, id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id, parent, main);
};
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { checkRoster } = require(path.join(root, 'src/lib/roster/check.ts'));
const issues = checkRoster({
  weekStart: '2026-03-23', prevSunday: [], times: new Map(), contractHours: {}, minijobbers: [],
  roster: {
    Saturday: [{ user_id: 'u', name: 'U', team: 'Kitchen', shift: '17:00–22:00' }],
    Sunday: [{ user_id: 'u', name: 'U', team: 'Kitchen', shift: '09:00–17:00' }],
  },
});
const actualRestHours = (Date.parse('2026-03-29T09:00:00+02:00') - Date.parse('2026-03-28T22:00:00+01:00')) / 3_600_000;
console.log({ actualRestHours, reportedIssues: issues });
assert.equal(actualRestHours, 10);
assert(issues.some(i => i.kind === 'rest'), 'DST-shortened 10h rest must fail the configured 11h policy');
