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
for (const [route, section] of [["/checklist","/ops"],["/hours","/attendance-hub"],["/attendance/corrections","/attendance-hub"],["/simulator","/analytics"],["/staff/test","/staff"]]) {
  pathname=route;
  for (const mobile of [false,true]) {
    const html=renderToStaticMarkup(React.createElement(exported.default,{role:"manager",mobile}));
    const active=[...html.matchAll(/<a href="([^"]+)" class="management-nav-link active"/g)].map(m=>m[1]);
    assert.deepEqual(active,[section],`${route}: one active destination in ${mobile?'mobile':'desktop'} navigation`);
  }
  assert.match(renderToStaticMarkup(React.createElement(exported.ManagementLocation,{role:"manager"})),new RegExp('href="'+section+'"'));
}
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

// router.refresh preserves mounted client pages: their identity must change with branch context.
(async () => {
  let branch = "a", mode = "branch", role = "brand_owner";
  const module = { exports: {} };
  const profile = () => ({ role, branch_id: "home", full_name: "Demo" });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/app/(app)/layout.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports: module.exports, process: { env: {} },
    require: name => {
      if (name === "react/jsx-runtime") return require(name);
      if (name === "@/lib/supabase/server") return { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile() }) }) }) }),
      }) };
      if (name === "@/lib/activeBranch") return { branchChoices: async () => [], activeBranchFor: async () => branch };
      if (name === "@/lib/viewMode") return { getViewMode: async () => mode };
      if (name === "@/lib/i18n/server") return { getLocale: async () => "en", getT: async () => k => k };
      if (name === "next/navigation") return { redirect: () => { throw Error("Unexpected redirect"); } };
      return { __esModule: true, default: () => null, ManagementLocation: () => null };
    },
  });
  function mainKey(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "main") return node.key;
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = mainKey(child); if (found !== undefined) return found;
    }
  }
  const key = async () => mainKey(await module.exports.default({ children: "page" }));
  const first = await key(); assert.equal(first, await key(), "same context preserves state");
  branch = "b"; assert.notEqual(first, await key(), "branch switch resets stale page state");
  mode = "hq"; const hq = await key(); mode = "branch";
  assert.notEqual(hq, await key(), "HQ and branch page state stay separate");
  role = "staff"; assert.match(await key(), /home/, "single-branch staff uses home context");
  console.log("Branch/HQ switches reset page identity; unchanged context remains stable.");
})().catch(error => { console.error(error); process.exitCode = 1; });
