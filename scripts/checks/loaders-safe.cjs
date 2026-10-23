// A client loader that awaits a server call and then clears `loading` must do so in
// try/catch/finally: if the request throws (network drop, 503, deploy mid-session)
// the skeleton otherwise spins forever and the user sees no error. Found on
// /transfers and 22 other pages in the 2026-10-22 staging run.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith(".tsx") && files.push(p); } })("src");
const bad = [];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  if (!s.slice(0, 60).includes("use client")) continue;
  for (const m of s.matchAll(/async function (\w+)\([^)]*\)[^{]*\{/g)) {
    let body = s.slice(m.index + m[0].length, m.index + m[0].length + 1500);
    const end = body.indexOf("\n  }"); if (end > 0) body = body.slice(0, end);
    if (body.includes("setLoading(false)") && body.includes("await") && !/try|catch|finally/.test(body)) bad.push(`${f} ${m[1]}()`);
  }
}
assert.deepEqual(bad, [], "Loaders without error handling (wrap in try/catch/finally):\n" + bad.join("\n"));
console.log(`Loaders: every client loader in ${files.length} files ends its loading state even when the request fails.`);
