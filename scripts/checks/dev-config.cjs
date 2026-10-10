const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../../next.config.ts"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
for (const mode of ["development", "production"]) {
  let instrumentationCalls = 0;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    process: { env: { NODE_ENV: mode } },
    require: (name) => {
      assert.equal(name, "@sentry/nextjs");
      return { withSentryConfig: (config) => { instrumentationCalls++; return config; } };
    },
  });
  assert.equal(instrumentationCalls, mode === "production" ? 1 : 0);
  assert.equal(exports.default.poweredByHeader, false);
  assert.equal(typeof exports.default.headers, "function");
}
console.log("Development skips Sentry instrumentation; production retains it.");
