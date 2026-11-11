# Codex handoff — 11 Nov 2026 (from Claude)

ROLE: reviewer + inventory owner. Repo: Next.js 16 + Supabase. Read ONLY the files listed per task (plus direct imports when needed). Do not re-scan the repo. Reply terse: findings as `file:line — problem — fix`.

HARD RULES
- No deploys, no prod writes, no git push. Prepare commands; Venky runs them.
- Never replay private/historical credential or demo migrations. Never touch `.env*`, `.audit-db/`, `.vercel/`, credential sheets, exports.
- Supabase MCP in this workspace = FarmersFresh project. NEVER use it for Schnitzery (prod = vxwtmtlkwvwcdegtcjuz).
- Staging only for write tests (`supabase_db_schnitzery-local-staging`, accounts in `.audit-db/local-staging/test-accounts.passwords.txt`, never echo passwords).
- Keep: legacy JWT secret (anon/service keys depend on it).
- Products are matched case-sensitively by (category, product, unit) — never bulk-rename units.

## T1 — Migration history repair (prepare only)
Hand-applied in prod via SQL editor (not in `supabase_migrations.schema_migrations`): every file in `supabase/migrations/` from `20261107120000` onward, plus older ones Venky ran by hand.
1. Produce a read-only SQL that lists, for each migration file ≥ 20261024000000, whether its main object exists in prod (table/column/function/constraint) and whether its version is in `schema_migrations`.
2. Output the exact `supabase migration repair --status applied <versions…>` command ONLY for versions whose objects are verified present. Nothing else.

## T2 — Review Claude's changes (diff vs main)
Run: `git diff main --stat` then review ONLY these. Focus: security (RLS/definer/grants), data correctness, idempotency, race conditions.
- `supabase/migrations/20261108090000_checklist_templates.sql`
- `supabase/migrations/20261108120000_prep_lists.sql`
- `supabase/migrations/20261108150000_shift_leader_inventory.sql` — swapped one permission clause in `private.edit_inventory_count`, `private.resolve_stock_batch_expiry`, `private.inventory_operation` via `pg_get_functiondef` + replace (`pg_temp.swap_guard`). RULE: any future redefinition of these three must keep `private.is_shift_leader(...)`. Check the swap is exact and receive_direct-without-cost is the only new shift-leader path.
- `supabase/migrations/20261109090000_day_closes.sql` — writes `daily_sales` only if missing (never overwrites POS import); mismatch → reason required.
- `supabase/migrations/20261109120000_cover_swaps.sql` — `private.move_roster_shift` (invoker) + `decide_cover_atomic` swap path.
- `supabase/migrations/20261109150000_temp_rooms.sql` — redefines `private.day_close_snapshot` (opening <15:00 / closing ≥15:00 Berlin).
- `supabase/migrations/20261109170000_leave_types.sql` — `leave_type`, sick-note own-folder check, `private.attach_sick_note`.
- Server: `src/lib/queries/{prep-list,shift-inventory,day-close,cover,leave,leave-balance,temp,hygiene-log}.ts`, `src/lib/inventory/shift-scope.ts`, `src/lib/auth/manager-paths.ts`, `src/proxy.ts`.
- Known trade-offs (don't re-flag unless wrong): sick-note signed URL uses service role after an RLS row check; temp slot by recorded_at hour (no slot column); prep suggestions = p75 of counted use, ≥3 days.
Checks already green locally: `scripts/checks/{checklist-templates,prep-lists,shift-leader-inventory,day-closes,cover-swaps}.cjs`, vitest `prep-list`, `cover-check`.

## T3 — Remove help texts in manager inventory forms (your area)
Venky's rule: no explanatory sentences under headings / in forms. Keep only data, real warnings, empty states, errors.
Files: `src/app/(app)/inventory/{prices,production,recipes,purchasing,batch-report}/**`, `src/components/inventory/{SupplierReturns,PurchasePacks,InvoiceCost,TransferLots}.tsx`.
Remove `<p>{s("…long explanation…")}</p>` style lines; keep conditional `{!x && <p>…</p>}` states. Then run `node scripts/checks/{a11y-static,design-tokens,workspace-ux}.cjs` and the e2e inventory suite on staging.

## T4 — Confirm purchasing race fix
`e2e/inventory-workspace.e2e.ts` ×5 runs on staging; report flakes only.

OUTPUT FORMAT
T1: SQL + repair command. T2: findings list (severity H/M/L) or "no findings". T3: changed-files list + check results. T4: pass/fail ×5.
