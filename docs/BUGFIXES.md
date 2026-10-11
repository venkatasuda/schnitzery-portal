# Audit fixes — 2026-10-11

These changes address the sixteen concrete findings in `graphify-out/CODE_AUDIT.md`. They are local changes on `feature/inventory-workspace`. The database migration has been tested against an isolated PostgreSQL runtime, not applied to production. Existing UI changes were preserved.

| Finding | Local resolution |
| --- | --- |
| A01 Role escalation | Explicit account-creation matrix; unknown and higher target roles fail closed; branch assignment required. |
| A02 Public push delivery | Delivery moved out of the server-action module into a server-only module. Subscription endpoints and stored delivery endpoints must use known HTTPS push providers. |
| A03 Rounded pay | Money uses exact paid minutes; display rounding cannot change pay. |
| A04 DST classification | Classification advances along elapsed UTC time and reads Berlin wall time at boundaries; spring and autumn changes tested. |
| A05 Inconsistent paid hours | Payroll, labor, personal hours, exports and branch analysis use the same paid-minute helper. Breaks are clipped to the shift and overlapping breaks are merged. |
| A06 Ambiguous latest counts | Date, creation time and ID determine latest counts consistently in operational views, forecasts and AI tools. |
| A07 Product-name collisions | Category, name and unit identify legacy stock records together. Delivery selection uses catalog ID. Active duplicate catalog identities are rejected by the migration. |
| A08 Invalid stock numbers | Server validation rejects non-finite/negative quantities and costs; stock text and calendar dates are validated. Database constraints reject new invalid stock and sales records. |
| A09 Cover partial writes | One invoker RPC locks the request and roster, verifies the claimant and matching shift, then updates both in a transaction. |
| A10 Document partial writes | One invoker RPC serializes approvals for an employee/document type and changes active versions atomically. A unique index permits one active approved version. |
| A11 Transfer races | Status changes condition the update on the branch and previously observed status; a lost race returns an error. |
| A12 Duplicate/missing expiry waste | One invoker RPC locks the batch and inserts waste before changing its status. Failure rolls back; a repeated disposal is idempotent. |
| A13 Failed reads shown as zero | Inventory, wages, labor, organization signals and branch analysis surface query failures. Inventory displays load failures. Document and expiry reads also return errors. |
| A14 Month boundaries | Shared date-only month boundaries and Berlin business dates replace local-midnight serialization. |
| A15 Forecast coverage | Rates use actual days between fully covered count pairs; last-count date and observed days are exposed. Counts older than one business day suppress suggested orders. Inactive products and future counts are excluded. |
| A16 Misleading cost labels | Purchase spend / sales is named accurately in English and German. Purchase-based remainder is not labeled gross margin. |

Additional changes: report queries page beyond Supabase's response cap and reject oversized reports rather than returning incomplete totals. AI chat accepts bounded text-only history, validates tool arguments at runtime, preserves branch/unit/date context, limits execution time and uses an atomic per-user rate limit. Required-document dashboards honor branch-specific overrides. Regression checks are blocking in CI.

## Verification

```powershell
npm test
node scripts/audit/reproduce-bugs.cjs
node scripts/checks/inventory-data.cjs
node scripts/checks/inventory.cjs
node scripts/checks/layout.cjs
node scripts/checks/dashboard.cjs
node scripts/checks/service-worker.cjs
node scripts/checks/dev-config.cjs
npm install --prefix .audit-db --no-save --package-lock=false @electric-sql/pglite@0.5.8
node scripts/checks/atomic-workflows.cjs
npm run build
git diff --check
```

The isolated runtime is ignored by Git and is not a production dependency. Database tests cover rollback, repeated disposal, cover retries, numeric constraints, rate limits, unauthorized roles and branch visibility. Mocked query checks execute the actual inventory server code. These do not substitute for testing deployed RLS and triggers.

## Rollout

1. Verify Schnitzery project identity and inspect its actual schema, RLS, grants, triggers and migration history. The locally linked reference is `vxwtmtlkwvwcdegtcjuz`; the connected Supabase tool exposed a different project and was not used for database operations. The CLI confirmed the Schnitzery reference is accessible.
2. Review existing duplicate active catalog identities, approved document versions, active cover requests and weekly roster rows. The unique indexes deliberately fail rather than delete duplicates automatically. Review legacy invalid quantities as well; new quantity checks are `NOT VALID`, preserving historical rows while rejecting invalid future writes.
3. Apply `supabase/migrations/20261011035503_audit_atomic_workflows.sql` to a staging copy and test with staff, manager, branch owner and brand owner accounts. Verify denied cross-branch writes and all existing trigger interactions. Take a backup before applying to production. Do not blindly push this repository's new migration directory over an unrelated remote migration history.
4. Apply the reviewed migration before deploying the code: approval, expiry and AI functions require its RPCs. If an RPC is missing, those actions return an error rather than reverting to unsafe multi-write behavior.
5. Deploy the tested branch and verify manager web navigation, staff mobile navigation, inventory counts, deliveries, forecasts, document approvals, cover decisions and disposal retries. Verify the deployed Git commit and invalidate stale service-worker assets as needed.

On 2026-10-11, the linked Schnitzery production schema and RLS were inspected. All four duplicate checks passed. The migration succeeded first inside a rolled-back live transaction, then through `supabase db push` after fetching existing migration history. Migration `20261011035503` is recorded remotely; anonymous execution is denied for all four RPCs. A rolled-back authenticated-manager test rejected request eleven. No employee records were altered by these checks. Retrieved historical migrations containing staff or credential data remain in ignored local storage and are excluded from this release. Git release and deployment verification follow separately. Authenticated end-to-end workflow checks on a staging clone remain unverified.

## Remaining architecture work

The audit's broader recommendations are not all bug fixes. Historical payroll still needs an approved snapshot and effective-dated wages before it can be immutable. Purchase/transfer/waste accounting needs a canonical movement ledger before presenting consumption cost or profit. Report queries now page up to 100,000 rows and fail clearly above that ceiling; database aggregation is the next step beyond this size. Franchise isolation, deployed privacy policies, credential rotation and offline-device behavior require live verification. Automated ordering, a nightly proposer, LangChain/Langfuse integration and evaluation datasets are separate features; this change does not claim they already exist.

The code graph is a structural index with a documented partial-parse/edge-health report. Documentation semantic fragments retain the prior audit snapshot; use this file for current fix status.
