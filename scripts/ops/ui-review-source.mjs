import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Only application source/configuration: never environment files, credentials or database exports.
export function uiReviewFingerprint(root) {
  const hash = createHash("sha256");
  const add = file => { hash.update(relative(root, file).replaceAll("\\", "/")); hash.update("\0"); hash.update(readFileSync(file)); hash.update("\0"); };
  const walk = dir => { for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name, "en"))) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file); else if (entry.isFile()) add(file);
  }};
  walk(join(root, "src"));
  for (const name of ["package.json", "package-lock.json", "next.config.ts", "postcss.config.mjs", "tsconfig.json"])
    if (existsSync(join(root, name))) add(join(root, name));
  return hash.digest("hex");
}
