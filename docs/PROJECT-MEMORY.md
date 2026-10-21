# Schnitzery Portal — Project Memory

> Status updated 2026-10-21: [review handoff](CLAUDE-REVIEW-HANDOFF.md) and
> [audit tracker](ops/AUDIT-STATUS.md) take precedence over the historical notes
> below. Latest implementation `e5b7d46` is local, not deployed. Last recorded
> production release is `94614db`. Local staging is unfinished; AI is deferred.

_A human-readable "state of the project": decisions, context, gotchas. Read this first
when picking the project back up. Append-only-ish; prune stale notes._

## What this is
Production multi-branch workforce + operations portal for the Schnitzery restaurant
franchise. Next.js 16 + Supabase (Postgres/RLS/Auth), deployed on Vercel, EN/DE,
mobile-first. See PRD / ARCHITECTURE for detail.

## Live project facts
- **Supabase project ref:** `vxwtmtlkwvwcdegtcjuz`.
- **Branches:** 19 seeded (Stuttgart `STG` = `20b8cb3e-2046-40d7-9f5e-c7ef18261bd6`,
  plus 18 Berlin/other, currently coded `SCH`). Stuttgart is the demo/primary branch
  and the only one with inventory loaded.
- **Stuttgart inventory:** 75 real products across 8 categories loaded via
  `scripts/ops/seed-stuttgart-inventory.sql` (untagged = real, cleanup won't remove it).
  Drinks loaded without Ist/Soll — managers to fill in-app. Old demo inventory removed.
- **Demo data:** sales/waste/attendance/temps/announcements/incidents seeded for the
  pitch; removable with `supabase/cleanup-demo-data.sql` + `create-demo-accounts.mjs --delete`.

## Key decisions (and why)
- **Permissions in the DB (RLS), not the UI** — a leaked endpoint can't leak another
  branch's data. Role helpers: `is_manager`, `is_owner`, `accessible_branch_ids`, etc.
- **Inventory is per-branch, never global** — Berlin branches sourcing from a cloud
  kitchen keep separate lists; managers manage their own via the existing add/edit UI
  (RLS `inv_master_write`: manager + own branch).
- **AI agent: honest Phase-1 scope** — read-only chat only, flag-gated OFF. The full
  spec (worker/approvals/execution/POS) is deferred; blind-merging it pre-pitch was the
  wrong move. The `schnitzery-ops-agent` repo holds the Phase-2 framework; its read tools
  are wired to the real schema. No separate agent DB role needed for Phase 1 because the
  model can only call 3 read tools (no arbitrary SQL) and runs under the caller's RLS.
- **Don't split frontend/backend, no platform-split mobile folders, no Jenkins** —
  right-sized for a small team on Vercel. Monorepo/GCP is a post-pitch step, documented
  but not executed.

## Gotchas / scars (don't relearn the hard way)
- **Next 16 ≠ older Next.** Middleware is `proxy.ts`. Read `node_modules/next/dist/docs/`.
- **Verify connector project scope.** The connected app exposed FarmersFresh during
  staging setup; Schnitzery required its authorized local CLI/API session. Use
  `apply_migration` for DDL through the connector; do not infer tool capabilities
  from old permission errors.
- **A guard trigger once referenced a dropped `hourly_wage` column** — broke every
  `users` update until fixed (migrations 07/08). Watch copied trigger bodies.
- **Permissions vary by reviewer environment.** Inspect current tool restrictions;
  the earlier E-drive sandbox limitation is not a universal project rule.
- **npm installs here can time out mid-extract** — if types resolve to `any`, suspect an
  incomplete install; run `npm install` locally to repair. Do **not** `npm audit fix --force`.
- **Business dates are Europe/Berlin** — use `src/lib/time/*`.

## Secrets / env (names only; values in .env.local + Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
VAPID public/private/subject, `ANTHROPIC_API_KEY`, `AGENT_CHAT_ENABLED`, `AGENT_MODEL`.

## Where things live
- Docs: `docs/` (PRD, ARCHITECTURE, DESIGN, ROADMAP, RULES, this file; ops/ + incidents/
  + architecture/ subfolders).
- Agent (portal side): `src/app/api/agent/chat/route.ts`, `src/components/AgentChat.tsx`,
  `src/app/(app)/assistant/page.tsx`.
- Agent (framework): separate repo `schnitzery-ops-agent` (+ its `INTEGRATION.md`).
- Seeds/ops scripts: `scripts/ops/*`. Pending migrations: `supabase/pending/*`.

## Current status
Use the six-area matrix in `ops/AUDIT-STATUS.md`. Payroll snapshots/wage history
and stock evidence are deployed. Offline replay/review, roster concurrency and
dialog/error improvements are committed locally in `e5b7d46`; their migration
is unapplied. Docker interrupted local staging setup. Unknown wage dates remain
unconfirmed. Reconciliation, valuation and full role/browser verification remain
open. The older AI flag and seed counts above were not rechecked for this handoff.
