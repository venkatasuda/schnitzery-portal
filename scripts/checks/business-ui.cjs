const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const assert = require('node:assert/strict');
const dictionary = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/i18n/messages.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: dictionary });
function t(key, vars = {}) {
  let value = key.split('.').reduce((v, k) => v?.[k], dictionary.messages.en) || key;
  for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}
function component(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, Intl, require(name) {
    if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name === 'next/navigation') return { usePathname: () => '/analytics' };
    if (name.endsWith('LanguageProvider')) return { useLang: () => ({ t, locale: 'en' }) };
    if (name === 'recharts') return { ...require(name), ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 720, height: 260 }) };
    return require(name);
  } });
  return exports.default;
}
const data = { from: '2026-10-05', to: '2026-10-11', metrics: { totalSales: 12450, laborCost: 3120, salesPerLaborHour: 78.6 }, business: { salesDays: 6, elapsedDays: 7, purchaseSpend: 2680, missingWageStaff: 1, wasteEntries: 8, salesTrend: [900, 1250, 1400, 2300, 2800, 3800, 0].map((sales, i) => ({ day: `2026-10-${String(5+i).padStart(2,'0')}`, sales, recorded: i !== 6 })) } };
const overview = renderToStaticMarkup(React.createElement(component('src/components/BusinessOverview.tsx'), { data }));
assert.ok(overview.includes('Purchase spending') && overview.includes('no wage set') && overview.includes('not consumption cost'));
if (process.argv[2]) {
  const nav = renderToStaticMarkup(React.createElement(component('src/components/ManagementNav.tsx'), { role: 'manager' }));
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  fs.writeFileSync(process.argv[2], `<!doctype html><html lang="en" class="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Schnitzery business workspace preview</title><style>${css}</style><div class="management-shell">${nav}<header class="app-header"><strong>Stuttgart · Management workspace</strong><span>Visual preview · illustrative data</span></header><main class="screen-wrap"><div class="dashboard-page-heading"><div><h1>Business performance</h1><p>Revenue, spending and the decisions behind them</p></div></div><div class="hub-tabs"><button class="hub-tab active">Business overview</button><button class="hub-tab">Workforce</button></div><div class="card" style="display:flex;gap:12px;margin-top:16px"><span class="status-badge good">This week</span><span>5–11 October 2026 · Stuttgart</span></div>${overview}</main></div></html>`);
}
console.log('Business overview renders data quality, spending labels and cost limitations correctly.');
