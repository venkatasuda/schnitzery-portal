# Codex scoped handoff response — 11 November 2026

Checkout: E:\Github Projects\Schnitzery; branch feat/day-close-logbook-swaps. No pushes, deploys, production access/writes, or Supabase connector use. Existing BACKLOG/handoff/seed edits preserved.

## T1 — prepare only

SQL: CODEX-MIGRATION-CHECK-2026-11-11.sql (33 migrations >= 20261024000000). It returns main-object presence and recorded migration version in one read-only result. Object existence alone does not verify function bodies, constraints, RLS or grants. Do not infer an applied security patch merely because its function predates the patch.

Repair command: withheld until production query results and patch definitions are verified. No production versions were verified in this task, so there is no safe exact version list to supply yet. Do not use `--status reverted` to hide missing local history; do not replay private migrations.

Validation: all 33 object expressions execute on staging. The full query cannot be validated there because the staging snapshot has no supabase_migrations.schema_migrations table. Staging has no cover_requests.return_work_date column; that is a staging schema gap, not evidence about production.

## T2 — review only; fixes for Claude

- supabase/migrations/20261109090000_day_closes.sql:80 — [M] Missing next-day prep lists bypass the reason requirement: JSON null compared with `<> 'sent'` yields SQL NULL, so IF does not run. Use `IS DISTINCT FROM 'sent'`. Verified with read-only PostgreSQL evaluation.
- supabase/migrations/20261109150000_temp_rooms.sql:23 (also 20261109090000_day_closes.sql:41) — [M] `greatest(existing_task_count, template_count)` counts completed unrelated/obsolete tasks toward absent required templates. Ten completed unrelated tasks plus ten uninstantiated required templates reports zero open tasks. Count existing tasks plus unmatched active template IDs; require completion of each applicable template. Verified arithmetic counterexample on staging.
- supabase/migrations/20261109090000_day_closes.sql:95 — [M] Concurrent POS/manual sales insertion after the snapshot but before `ON CONFLICT DO NOTHING` can silently leave a different daily_sales amount without a sales-mismatch reason. Insert/reconcile the winning sales row before final reason validation and freeze that reconciled value; coordinate updates under the same concurrency protocol. Static race analysis; not reproduced with production writes.
- supabase/migrations/20261109120000_cover_swaps.sql:49 — [M] Approval still requires the caller's home branch, while src/lib/queries/cover.ts:148 lists the selected accessible branch. An HQ/multi-branch reviewer can see another branch's requests but cannot decide them. Check the request branch against accessible_branch_ids, retaining manager/RLS checks. This limitation is retained in the new function definition; it is not claimed as a newly introduced regression.

Shift-leader guard review: each old permission clause occurs once in the latest tracked predecessor; accessible-branch checks remain. The added inventory_operation route is receive_direct only, array lines, no non-null line cost. Stocktake publishing remains manager-only. No additional confirmed security finding in these guards. The replacement helper is source-sensitive; preserve the three shift-leader clauses in future redefinitions.

Known accepted trade-offs were not re-flagged. Review is scoped static analysis plus the two read-only SQL counterexamples, not a claim of full security certification.

## T3 — changed files

- src/app/(app)/inventory/prices/page.tsx
- src/app/(app)/inventory/production/page.tsx
- src/app/(app)/inventory/recipes/page.tsx
- src/app/(app)/inventory/purchasing/page.tsx
- src/components/inventory/SupplierReturns.tsx
- src/components/inventory/PurchasePacks.tsx
- src/components/inventory/InvoiceCost.tsx
- src/components/inventory/TransferLots.tsx

Removed explanatory paragraphs; kept real warnings, conditional states, errors, validation, labels, price/stock data and recall/valuation limitations. batch-report required no removal: its prose expresses actual valuation/traceability limitations or data states.

Checks: a11y-static PASS; design-tokens PASS; workspace-ux PASS; git diff --check PASS (line-ending advisory only). No full build requested or claimed.

Seed: renamed Bread fridge / Cheese fridge to Bread freezer / Cheese freezer, preserving the pre-existing freezer kind and -25 to -18 Celsius ranges. Seed NOT executed. If old names were already seeded, this insert-only seed does not rename existing rows; review those rows before rerunning to avoid duplicates.

## T4 — staging only

Command: npx playwright test --config=e2e/playwright.config.ts e2e/inventory-workspace.e2e.ts --repeat-each=5 --workers=1 --retries=0

Completed: 5 failed, 5 passed, 5 skipped; 18.3 minutes; retries disabled.

| Repetition | Purchasing workflow | Mobile German layout | Saved count |
| --- | --- | --- | --- |
| 1 | FAIL — line 77 staff alert absent | PASS | SKIP — existing draft |
| 2 | FAIL — line 77 staff alert absent | PASS | SKIP — existing draft |
| 3 | FAIL — cleanup ERR_TOO_MANY_REDIRECTS | PASS | SKIP — existing draft |
| 4 | FAIL — line 77 staff alert absent | PASS | SKIP — existing draft |
| 5 | FAIL — line 77 staff alert absent | PASS | SKIP — existing draft |

The repeated failure expects getByRole("alert").filter({hasText:"Active manager access"}) after staff navigates to the manager purchasing URL. The listed proxy now redirects non-managers away from manager paths. Align the browser assertion with the intended redirect and separately assert server/database denial; do not weaken permissions to satisfy this old inline-alert expectation. Four runs reached this assertion after order/receiving/credit checks. This does not establish full end-to-end success or independently prove the old purchasing race absent.

Repetition 3 reported the cleanup error at e2e/local.ts:101, called from inventory-workspace.e2e.ts:84. Cleanup errors can obscure the original test failure; preserve the primary failure and investigate the redirect chain separately. The report does not claim a diagnosed authentication root cause.

Skipped saved-count cases deliberately preserve an existing staging count draft. They are NOT passes. No permission/schema fix or test assertion was changed during T4. Tests ran against the already-running local staging server; its synchronization with this edited checkout was not independently established, so this is not a browser certification of the T3 cleanup.
