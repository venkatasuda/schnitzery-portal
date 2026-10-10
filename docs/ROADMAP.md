# Schnitzery Portal — Roadmap & Tasks

_Last updated: 2026-10-10. Living checklist. Tick items as they ship; don't let it rot._

## Now (pre-pitch / immediate)
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
