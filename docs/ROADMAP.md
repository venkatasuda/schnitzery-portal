# Schnitzery Portal — Roadmap & Tasks

_Status updated: 2026-10-21. Older planning checklist retained below for context._

## Current plan — release train (set by lead, 2026-10-21)

Small, separately reviewed releases. Built-and-reviewed safety fixes ship as soon as
they are verified; they do not wait behind new features.

| Release | Scope | Gate | Status |
|---|---|---|---|
| **A** | Offline attendance + roster integrity (`e5b7d46`, `a9f3c28`) | Staging browser pass (RELEASE runbook Step 0b) | ✅ **Deployed 2026-10-21** (migration applied, prod release `bba3d17`) · smoke test pending |
| **A.1** | Hotfix: auth proxy redirected `/sw.js`, `/offline.html`, manifest to login for signed-out visitors | `service-worker.cjs` proxy assertion | ✅ Live (verified `/sw.js` loads signed-out) |
| **E** (owner's priority #2) | Payroll gaps: historical branch assignments, frozen-approval verification | Design note + staging verification; never invent wage dates | ✅ **Live** 2026-10-21 (prod build `488597b`, promoted after an out-of-order deploy) · DB migration `20261021120000` must be applied for the fix to take effect · runbook [RELEASE-E](ops/RELEASE-E-payroll-branch-history.md) |
| B | UI/UX checks: roster, staff, reports, settings, dialogs (German, keyboard, 390px) + staging findings B1 (English server errors in German UI), B2 (unlocalized date), B3 (stale "saved offline" note) | Staging review incl. 390px | B1–B3 **built** (roster errors translated via codes, clock date follows app language, offline note clears + status reloads after sync); checks pass · 390px review still open |
| C | Stock reconciliation (counts/deliveries/transfers/waste → reviewable, flag unexplained) | Short design agreed **before** building | After E |
| D | Reliable analytics: prices/valuation, missing ≠ zero, cost only when supported | **Depends on C** | After C |

Owner decisions 2026-10-21: ship early in small releases; payroll gaps (E) first
after A; Codex builds / Claude verifies + reviews + releases.

Release A detail: [RELEASE-e5b7d46.md](ops/RELEASE-e5b7d46.md) ·
review: [REVIEW-e5b7d46.md](ops/REVIEW-e5b7d46.md) · rollback:
`scripts/ops/rollback-offline-migration.sql`.

Done: local staging (Docker, schema-only baseline, migration applied locally, six
synthetic accounts, eleven checks — see [LOCAL-STAGING.md](ops/LOCAL-STAGING.md)).

### Working agreement (Codex + Claude)
- **Codex builds** C, D, E — each on its own `feature/*` branch, never directly on a
  branch under review or release.
- **Claude verifies + releases** — staging browser verification, independent review
  of every feature branch before merge, then develop → main with exact-head CI.
- One agent per branch at a time. Status of record: `docs/ops/AUDIT-STATUS.md`.
- Invariants for everyone: AI deferred · never invent wage effective dates · no
  real payroll/attendance/wage records as test fixtures · staging only on the local
  isolated stack · verify Supabase project identity before any write.

### Business actions (not code — owner/managers)
- Confirm actual wage **effective dates** in Labour Cost. Until then, payroll
  approval stays blocked for affected employees (by design; dates are never guessed).
- Confirm kitchen device browsers (F5): offline clocking needs Safari/iOS ≥ 15.4.

The six-area progress matrix is in [audit status](ops/AUDIT-STATUS.md). AI remains
deferred. The older checklist below is not a current deployment instruction;
revalidate unchecked items before acting on them.

## Historical pre-pitch checklist (2026-10-10)
- [ ] Commit + push outstanding work to `main`; create/sync `develop`.
- [ ] Set GitHub branch protection on `main` + `develop` (require CI gate + gitleaks).
- [ ] Enable Supabase leaked-password protection.
- [ ] Enter per-branch inventory lists (managers) — Stuttgart real catalogue is loaded
      (75 products); Berlin/other branches start empty by design.
- [ ] Enter Drinks Ist/Soll figures for Stuttgart (loaded without stock numbers).
- [ ] Delete leftover `tsconfig.agentcheck.json` from repo root.

## AI ops assistant
- [x] Phase 1 — read-only chat (`/api/agent/chat` + `/assistant`), flag-gated off.
      Tools: stock levels, expiry risk, waste trend; branch-scoped via RLS.
- [ ] Turn on in staging (`AGENT_CHAT_ENABLED=true`), confirm model string, sanity-test.
- [ ] Optional: `/assistant` nav link for managers (shown only when flag on).
- [ ] Phase 2 — background worker (Supabase Queues), approval inbox + state machine
      (draft→pending_approval→approved→executing→succeeded), `propose_*` write tools
      (purchase orders, transfers → `pending_review`), dedicated `ops_agent` SELECT-only
      DB role, Langfuse tracing, evals in CI.
- [ ] Phase 3 — approved actions execution, POS integration.

## Platform hardening
- [ ] Review the 20 npm audit findings properly (do **not** `audit fix --force`).
- [ ] Finish incremental adoption of generated DB types (`DB-TYPES-ADOPTION.md`).
- [ ] Expand test coverage around RLS/role boundaries and attendance stamping.

## Infrastructure (post-pitch)
- [ ] Monorepo migration (Turborepo + pnpm; apps/web|api|agents, packages/core|db|ui) —
      see `docs/architecture/MONOREPO-MIGRATION.md`.
- [ ] Containerize (Dockerfile.web already drafted) + GCP Cloud Run deploy; Terraform;
      Secret Manager.
- [ ] Mobile: finalize Capacitor hybrid shell / store builds (`docs/ops/MOBILE-APP.md`).

## Demo / handover
- [x] Seed demo data (sales, waste, attendance, temps, announcements, incidents).
- [x] Cleanup script for clean handover (`supabase/cleanup-demo-data.sql`).
- [ ] Run cleanup at handover if the client wants a blank production system.

## Design
- [ ] Per-component design-system doc (variants, states, a11y).
- [ ] Page-by-page polish audit (reviewer flagged some screens as raw).

## Done (recent)
- [x] Login lockout (3-strike, manager-cleared) + forced first-login password change.
- [x] Role dashboards with charts; web-push notifications.
- [x] Inventory/ops suite, waste/expiry, transfers, HACCP, cost tooling.
- [x] CI/CD + branching strategy; CodeQL + gitleaks.
- [x] Stuttgart real inventory catalogue loaded; demo inventory removed.
