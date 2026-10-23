// Every fixed error string a server action returns must have a German translation in
// src/lib/i18n/serverMessages.ts, otherwise German staff see English toasts.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const map = fs.readFileSync("src/lib/i18n/serverMessages.ts", "utf8");
const missing = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".ts")) for (const m of fs.readFileSync(p, "utf8").matchAll(/error: "([^"]+)"/g)) if (!map.includes(JSON.stringify(m[1]) + ":")) missing.add(m[1]);
  }
})("src/lib/queries");
assert.deepEqual([...missing], [], "Add German for these server messages in serverMessages.ts:\n" + [...missing].join("\n"));
console.log("Server messages: every fixed server error has a German translation.");
