# Schnitzery: Claude review handoff

Updated 2026-10-21 (Europe/Berlin). Review source and evidence before making
changes. This document describes the last observed state; it does not certify
the full audit or current production health.

## Read first

1. `AGENTS.md`: read relevant installed Next.js 16.2.7 guides before coding.
2. `docs/ops/AUDIT-STATUS.md`: current audit matrix and staging blocker.
3. This implementation diff: `git diff 94614db..e5b7d46`.
4. `docs/PAYROLL-APPROVALS.md`, `docs/STOCK-HISTORY.md`, then feature source.

Older PRD/design/roadmap/architecture documents contain intent and historical
notes. They are not evidence that features are deployed or verified. The code
graph predates this implementation; use source for the changed files.

## State and scope

| Item | Last observed state |
| --- | --- |
| Workspace | `E:\Github Projects\Schnitzery` |
| Local branch | `codex/offline-roster-integrity` |
| Implementation commit | `e5b7d46` (parent `94614db`) |
| Release | Latest recorded live main `94614db9401ac829ce2a75500ca520d03f917934`, PR #43 |
| Website | https://schnitzery-portal.vercel.app/ |
| Production Supabase | `vxwtmtlkwvwcdegtcjuz`; organization `ytkyidefqefejvxrqgcq` |
| Vercel | `venkatasudas-projects/schnitzery-portal` |
| Pending migration | `20261017160350_offline_attendance_integrity.sql`; not applied |
| Staging | Local setup attempted, not running or verified |

The user wants professional management web layouts for managers, branch owners
and brand owners, with focused employee navigation. One Schnitzery brand spans
all branches and roles; do not claim unrelated-franchise tenant isolation. AI
work is deferred. Existing wage effective dates are unknown: leave unconfirmed
and block affected payroll approvals, never invent dates.

## What the implementation changes

- Offline capture: per-tab authenticated ownership, durable-save errors, Web
  Locks across tabs, ownerless legacy evidence retained without reassignment.
- Sync: verified current identity, batches of 100, UUID/status acknowledgements,
  retries retained, review-needed results distinguished from applied hours.
- Database replay: active branch membership, protocol/QR/location/time-window
  gates, chronology/overlap checks, one open shift, Berlin work date, pending
  approvals and idempotency. Invalid evidence is retained for review.
- Manager review: branch-scoped immutable notes, visible to the employee;
  marking reviewed does not correct hours or approve payroll.
- Service worker: redirected/private responses excluded during installation,
  private navigations use a public bilingual offline fallback, unrelated caches
  retained. This is not proof of full offline browser behaviour.
- Roster: validate staff/role/shift inputs, compare loaded JSON snapshot before
  saving, reject stale writes and copying over a populated destination week.
- UX: shared native dialog for four overlays; document/attendance/roster read
  failures expose retry instead of false empty data or an editable stale plan.
- Inputs: reject blank delivery costs and future sales/deliveries; exclude
  future dated records from affected business totals.

## Review priorities

1. Trace capture, storage, account switch, sync and replay end to end. Check
   cross-tab changes, old clients, partial results, rejected events, duplicate
   UUIDs, storage corruption/quota, exhausted retries and offline reload.
2. Review SQL grants/RLS/definer boundaries against the actual production
   schema. Check branch reassignment, direct RPC calls, existing triggers,
   historical/approved shifts, overnight/DST and transaction rollback.
3. Verify roster JSON equality through actual PostgREST, simultaneous saves,
   week copying, stale loads and preserving an unsaved draft after rejection.
4. Exercise manager/employee review flows, keyboard focus/Escape/restoration,
   German text, narrow screens and recoverable failures. Avoid stale zero KPIs.
5. Check new date filters and explicit zero-cost handling without presenting
   purchase spending or depletion as verified consumption cost or profit.

These are review targets, not assertions of known bugs. Report reproducible
findings with severity, file/line, trigger and smallest safe fix. Keep changes
focused; no dependency additions or AI expansion are needed for this review.

## Evidence and limits

On 2026-10-17: production build, TypeScript, 42 Vitest tests and existing
regression/isolated PostgreSQL checks passed. New offline client/database,
service-worker and roster checks passed. Focused TypeScript/UI/date checks were
rerun after final follow-ups. The complete build was not rerun after every final
edit. Tests have not been rerun for this documentation-only handoff.

Runnable checks:

```powershell
npm test -- --coverage
npx tsc --noEmit
npm run build
node scripts/checks/offline-client.cjs
node scripts/checks/offline-database.cjs
node scripts/checks/roster-integrity.cjs
node scripts/checks/service-worker.cjs
node scripts/checks/workspace-ux.cjs
```

Database checks require the pinned PGlite runtime under `.audit-db/node_modules`;
CI installs it as shown in `.github/workflows/ci.yml`. They execute isolated
fixtures; mocks/fixtures are not full production-schema or browser proof.

Full staging employee/manager/owner workflows, cross-branch recovery, browser
disconnection/account switching and the final page-by-page UX sweep are pending.
Stock evidence is deployed, but reconciliation, verified consumption and reliable
valuation remain unfinished. Historical branch assignments remain open.

## Resume staging safely

First verify Docker is healthy; the last attempt stopped during an update.
Use `.audit-db/local-staging/supabase/config.toml`, not production's linked workdir,
for local commands. The initial schema-only dump is empty/failed. Obtain a valid
schema baseline without production rows, then apply the pending migration only
locally. Do not replay old production seed/password migrations. Create synthetic
employee/manager/branch-owner/brand-owner accounts and at least two branches.
Keep staging app config separate from production and disable AI/external sends.

The currently connected Supabase app may point at FarmersFresh. Never use it for
Schnitzery writes without verifying project identity. Local CLI access also needs
rechecking. Avoid real payroll/attendance/wage mutations as test fixtures.

## Share and exclude

Share tracked source, tests and docs through a private review workspace. Review
locally against the commit above; no remote-tracking branch currently contains
it in the inspected Git inventory. This handoff does not push or deploy it.

Do not share `.env*`, `.audit-db/`, `.vercel/`, credential sheets, roster exports,
tokens, private historical migrations or generated diagnostics. `.audit-db/`
contains credentials/auth helpers as well as test artifacts. Do not upload the
entire working directory. Use Git's tracked file list; secret-scan any bundle.

Suggested review prompt:

> Read docs/CLAUDE-REVIEW-HANDOFF.md and docs/ops/AUDIT-STATUS.md. Independently
> review git diff 94614db..e5b7d46 for correctness, data loss, authorization,
> accessibility and migration compatibility. Run targeted checks. Report concrete
> findings and distinguish tested behaviour from assumptions. Do not deploy,
> modify production records, invent wage dates or activate AI as part of review.
