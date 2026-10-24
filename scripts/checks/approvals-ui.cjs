const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function renderAfterLoad(fail) {
  const states = [];
  const effects = [];
  let cursor = 0;
  let initial = true;
  const hooks = {
    ...React,
    useState(value) {
      const index = cursor++;
      if (initial) states[index] = value;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect(effect) { if (initial) effects.push(effect); },
    useRef() { return { current: null }; },
  };
  const exports = {};
  const result = fail ? { ok: false, error: 'Database unavailable' } : { ok: true, leave: [], swaps: [], rows: [], items: [] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/(app)/approvals/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports,
    require(name) {
      if(name==='@/lib/format')return {appLocale:()=>'en-GB',formatEur:(n)=>n==null?'—':'€'+n};
      if (name === 'react') return hooks;
      if (name.startsWith('@/lib/queries/')) return new Proxy({}, { get: () => async () => result });
      if (name === '@/components/LanguageProvider') return { useLang: () => ({ locale: 'en', t: key => key }) };
      if (name === '@/components/Toast') return { toast() {} };
      if (name === '@/components/Skeleton') return { CardSkeleton: () => null };
      if (name === '@/components/Icon') return { __esModule: true, default: () => null };
      return require(name);
    },
  });
  exports.default();
  for (const effect of effects) effect();
  await new Promise(resolve => setImmediate(resolve));
  initial = false;
  cursor = 0;
  return renderToStaticMarkup(exports.default());
}

(async () => {
  const failed = await renderAfterLoad(true);
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Database unavailable/);
  assert.doesNotMatch(failed, /approvals.caughtUp/);
  const empty = await renderAfterLoad(false);
  assert.match(empty, /approvals.caughtUp/);
  assert.match(empty, /aria-pressed="true"/);
  console.log('Approvals distinguish failed reads from an empty queue; filters expose selection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
