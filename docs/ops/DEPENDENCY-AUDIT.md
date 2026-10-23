# Dependency audit — 2026-10-22

`npm audit` reported 23 findings (2 critical, 14 high, 7 moderate). Each was reviewed; no
`--force` was used. After the changes below: **8 remain, all in developer tooling that never
ships to users** (0 critical).

## Fixed (version bumps within the same major)
| Package | Was | Now | Why it mattered |
| --- | --- | --- | --- |
| `next` | 16.2.7 | 16.4.2 | **Critical, runtime.** Proxy bypass and a Server Actions denial-of-service. Also brings patched `postcss` and `sharp` (image processing). |
| `@sentry/nextjs` | 10.65 | 10.76.2 | **Critical, runtime.** Bypass via the tunnel route — we use one (`/monitoring`). |
| `eslint-config-next` | 16.2.7 | 16.4.2 | Keep in step with `next`. |
| `vitest`, `@vitest/coverage-v8` | 4.1.10 | 4.1.12 | Test runner file-read / code-injection (dev only). |
| transitive: `nanoid`, `fast-uri`, `js-yaml`, `brace-expansion`, `browserslist`, `source-map-js`, `vite`, `baseline-browser-mapping` | — | patched | Pulled up by `npm audit fix` (no breaking changes). |

## Accepted (dev tooling only)
| Finding | Path | Why accepted |
| --- | --- | --- |
| `braces`, `micromatch`, `fast-glob` (high) | `eslint-config-next` → `@next/eslint-plugin-next` | Only runs on our own source during lint. npm's suggested "fix" is downgrading to Next 14 — wrong. Re-check when Next ships a new eslint plugin. |
| `uuid`, `xcode` (moderate) | `@capacitor/cli` | Only used to build the Android app on a developer machine, so it moved to `devDependencies`. Suggested fix is a downgrade. Re-check with the next Capacitor release. |

## After pulling
Run `npm ci` (the lockfile changed). Re-check monthly with `npm audit --omit=dev`, which
should report 0.
