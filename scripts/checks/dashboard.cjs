const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const source = fs.readFileSync(path.join(__dirname, "../../src/app/(app)/page.tsx"), "utf8");
const code = ts.transpileModule(source + "\nexport { ManagerDash, OwnerDash };", {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const exportsForCheck = {};
vm.runInNewContext(code, {
  exports: exportsForCheck,
  require: (name) => {
    if (name === "react/jsx-runtime") return require(name);
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name.startsWith("@/")) return new Proxy({}, { get: () => () => null });
    throw new Error(`Unexpected import: ${name}`);
  },
});
const t = (key) => key;
const props = { t, ops: null, live: null, ot: null, sched: null, clockedIn: false, onBreak: false };
const render = (component, input) => renderToStaticMarkup(React.createElement(component, input));
const unavailable = render(exportsForCheck.ManagerDash, props);
assert.ok(unavailable.includes("homeDashboard.unavailable"));
assert.ok(!unavailable.includes("home.allClear"));
assert.ok(unavailable.includes('href="/attendance"'));
const owner = render(exportsForCheck.ManagerDash, { ...props, owner: true });
assert.ok(!owner.includes('href="/attendance"'));
const ready = render(exportsForCheck.ManagerDash, { ...props, ops: { lowStock: 4, pendingApprovals: 0, openIncidents: 0, checklistTotal: 0 }, sched: { staffCount: 0, submissionCount: 0, rosterExists: true } });
assert.ok(ready.includes("home.lowStock"));
assert.ok(!ready.includes("home.allClear"));
const hq = render(exportsForCheck.OwnerDash, { t, data: null });
assert.ok(hq.includes("homeDashboard.unavailable"));
assert.ok(!hq.includes('href="/attendance"'));
console.log("Dashboard unavailable states, stock alerts and owner clock visibility pass.");
