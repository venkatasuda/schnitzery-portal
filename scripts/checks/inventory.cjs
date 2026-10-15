const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = fs.readFileSync(path.join(__dirname, "../../src/app/(app)/inventory/page.tsx"), "utf8");
const names = [...source.matchAll(/const \[([\w]+),\s*[\w]+\] = useState/g)].map((match) => match[1]);
let state = {}, index = 0;
const exported = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, {
  exports: exported,
  require: (name) => {
    if (name === "react") return { ...React, useEffect: () => {}, useState: (initial) => {
      const key = names[index++];
      return [Object.hasOwn(state, key) ? state[key] : initial, () => {}];
    } };
    if (name === "@/lib/inventory/identity") return { inventoryKey: item => JSON.stringify([item.category || "", item.product, item.unit || ""]) };
    if (name === "react/jsx-runtime") return require(name);
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "@/components/LanguageProvider") return { useLang: () => ({ t: (key) => key }) };
    return new Proxy({ __esModule: true }, { get: (_, key) => key === "__esModule" ? true : () => null });
  },
});
const products = [{ id: "butter", product: "Butter", category: "Dairy", soll: 10 }, { id: "rice", product: "Rice", category: "Dry goods", soll: 20 }, { id: "oil", product: "Oil", category: "Dry goods", soll: 3 }];
const counts = { '["Dairy","Butter",""]': { ist: 2 }, '["Dry goods","Rice",""]': { ist: 20 } };
function render(overrides = {}) {
  state = { loading: false, products, counts, ...overrides }; index = 0;
  return renderToStaticMarkup(React.createElement(exported.default));
}
const count = render();
assert.ok(count.includes("Butter") && count.includes("Rice") && count.includes("Oil"));
assert.ok(!count.includes("inv.removeProduct"));
assert.ok(!count.includes("inventory-summary"));
assert.ok(render({ tab: "catalog" }).includes("inv.removeProduct"));
assert.ok(!render({ tab: "catalog" }).includes("scan.scanToCount"));
assert.ok(render({ search: "  RICE " }).includes("Rice"));
assert.ok(!render({ search: "rice" }).includes("Butter"));
assert.ok(!render({ activeCat: "Dairy" }).includes("Rice"));
assert.ok(!render({ statusFilter: "low" }).includes("Rice"));
assert.ok(render({ statusFilter: "uncounted" }).includes("Oil"));
assert.ok(!render({ statusFilter: "uncounted" }).includes("Butter"));
assert.ok(render({ search: "missing" }).includes("inventoryWorkflow.reset"));
assert.ok(render({ search: "missing", countView: "grid" }).includes("inventoryWorkflow.reset"));
assert.ok(render({ tab: "deliveries" }).includes("inventory-delivery-grid"));
const forecast = render({ tab: "forecast", forecast: { items: [{ product: "Butter", current: 2, usageRate: 1, daysLeft: 2, suggested: 5 }] } });
assert.ok(forecast.includes("<table") && forecast.includes("inventoryWorkflow.coverage"));
assert.ok(render({tab:"forecast",forecast:{items:[{product:"Butter",needsReview:true,current:2,usageRate:null,daysLeft:null,suggested:0}]}}).includes("inventoryReview.recount"));
const incomplete=render({tab:"analytics",analytics:{hasPurchases:true,hasCounts:true,needsReview:true,totalSpend:20,totalUsageEur:null,stockValue:null,trend:[],byCategory:[],topSpend:[],topUsage:[]}});
assert.ok(incomplete.includes("inventoryReview.explanation"));
assert.ok(!incomplete.includes("€0"),'Unavailable estimates must not render as free stock or zero depletion');
console.log("Inventory search, combined filters, catalog actions and delivery layout pass.");
