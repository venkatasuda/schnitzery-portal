# Schnitzery Portal — Project Memory

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
- **`execute_sql` via the Supabase tool is read-only** — use `apply_migration` for writes.
- **A guard trigger once referenced a dropped `hourly_wage` column** — broke every
  `users` update until fixed (migrations 07/08). Watch copied trigger bodies.
- **Mounted drive (E:) is read-only to the sandbox for deletes** — Claude can create/edit
  files but not `rm`; deletions must be done by the user.
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
Phase-1 agent built + typechecks clean (flag off). Stuttgart inventory real + clean.
Outstanding: push to main, branch protection, enable agent in staging, enter Drinks
figures, delete `tsconfig.agentcheck.json`. See ROADMAP for the full list.
