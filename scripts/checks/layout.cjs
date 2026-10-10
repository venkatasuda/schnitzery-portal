const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const path = require("node:path");
const root = path.join(__dirname, "../..");
let pathname = "/inventory";
const exported = {};
const source = fs.readFileSync(path.join(root, "src/components/ManagementNav.tsx"), "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, {
  exports: exported,
  require: (name) => {
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "next/navigation") return { usePathname: () => pathname };
    if (name === "@/components/LanguageProvider") return { useLang: () => ({ t: (key) => key }) };
    return require(name);
  },
});
assert.equal(typeof exported.default, "function");
for (const role of ["manager", "branch_owner", "brand_owner", "super_admin"]) {
  const html = renderToStaticMarkup(React.createElement(exported.default, { role }));
  assert.ok(html.includes('aria-current="page"'));
  assert.equal(html.includes('href="/branches"'), ["brand_owner", "super_admin"].includes(role));
}
const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
assert.ok(layout.includes('import Script from "next/script"'));
assert.ok(layout.includes('<Script id="theme-init" strategy="beforeInteractive"'));
const themeScript = layout.match(/const themeScript = `([^`]+)`/)[1];
for (const saved of [null, "light", "dark", "blocked"]) {
  let light = false;
  vm.runInNewContext(themeScript, {
    localStorage: { getItem: () => { if (saved === "blocked") throw new Error("blocked"); return saved; } },
    document: { documentElement: { classList: { add: (name) => { light = name === "light"; } } } },
  });
  assert.equal(light, saved !== "dark");
}
console.log("Navigation exports and role renders, theme initialization pass.");
