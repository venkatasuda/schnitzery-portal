const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const handlers = {};
let cacheReads = 0;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../public/sw.js"), "utf8"), {
  URL,
  self: { location: { origin: "http://localhost:3000" }, addEventListener: (name, handler) => { handlers[name] = handler; } },
  caches: { match: async () => { cacheReads++; return { cached: true }; } },
});
async function check(pathname, shouldCache, mode = "cors", method = "GET") {
  let response;
  const before = cacheReads;
  handlers.fetch({ request: { url: `http://localhost:3000${pathname}`, mode, method }, respondWith: (result) => { response = result; } });
  if (response) await response;
  assert.equal(cacheReads > before, shouldCache, pathname);
}
(async () => {
  await check("/_next/static/css/app/layout.css?v=12345678", false);
  await check("/_next/static/chunks/webpack.js?v=12345678", false);
  await check("/_next/static/chunks/4d96fe8637219abf.js", true);
  await check("/inventory", false, "navigate");
  await check("/api/agent/chat", false, "cors", "POST");
  console.log("Mutable dev assets bypass cache; hashed production assets remain cached; private pages remain network-only.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
