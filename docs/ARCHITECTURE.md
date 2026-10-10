# Schnitzery Portal — Architecture

_Last updated: 2026-10-10. Grounded in the current codebase and database._

## 1. Stack
- **Frontend/Backend:** Next.js 16.2.7 (App Router, React Server Components, Server
  Actions, Turbopack). Note: Next 16 renames middleware to `proxy.ts`. `output: "standalone"`
  is set for containerization.
- **Language:** TypeScript (strict). React 19.2.
- **Database/Auth:** Supabase (Postgres + Row-Level Security + Auth). Passwords in
  `auth.users` (bcrypt via `pgcrypto`). Privileged logic in `SECURITY DEFINER` functions.
- **Hosting/CD:** Vercel (main = production, develop = staging preview).
- **Other:** recharts (dashboards), web-push + VAPID (notifications), Capacitor (hybrid
  mobile shell), Sentry (errors), docx/qrcode (exports/labels), `@anthropic-ai/sdk`
  (ops assistant).
- **i18n:** custom dictionary `src/lib/i18n/messages.ts` (EN + DE), `useLang()` client hook.

## 2. Security model (the core design decision)
Permissions live in the **database**, so the UI is a convenience layer, not the gate.

**Role helpers (SQL):** `role_rank()`, `current_role()`, `current_branch()`,
`is_manager()`, `is_owner()`, `accessible_branch_ids()`.

**RLS pattern:** every branch-scoped table has
- a SELECT policy: `branch_id IN (SELECT accessible_branch_ids())`
- a write policy: `is_manager() AND branch_id IN (SELECT accessible_branch_ids())`
(exact columns/roles vary per table). Owners (`brand_owner`/`super_admin`) get all
branches via `accessible_branch_ids()`; everyone else is confined to their own.

**Keys:** the anon key + the user's session cookie drive normal requests (RLS applies).
The service-role key is **server-only**, used in a handful of gated API routes
(`src/app/api/*`) that first verify the caller's session and rank before acting.

**Attendance integrity:** clock events are stamped server-side through privileged
functions; the client cannot fabricate worked hours.

**Account security:** 3-strike login lockout (`auth_throttle` + `users.login_locked`,
self-healing window), forced first-login password change (`users.must_change_password`).

## 3. Data model (41 tables, grouped)
- **Identity & org:** `franchises`, `branches`, `branch_settings`, `users`,
  `user_branches` (M:N for multi-branch owners), `user_pay`, `user_documents`,
  `required_documents`, `certifications`, `kiosks`.
- **Attendance:** `attendance_logs`, `attendance_events`, `attendance_corrections`,
  `clock_overrides`.
- **Scheduling:** `weekly_roster`, `shift_templates`, `shift_times`, `availability`,
  `leave_requests`, `cover_requests`, `swap_requests`, `shift_broadcasts`.
- **Inventory & ops:** `inventory_master` (soll = reorder point), `inventory_counts`
  (ist = counted qty), `inventory_purchases`, `stock_batches` (expiry/FIFO),
  `stock_transfers`, `waste_log`, `daily_sales`.
- **Food safety:** `temp_units`, `temp_logs`, `incidents`, `checklists`.
- **Payroll inputs:** `payroll_runs`, `payroll_settings`.
- **Platform:** `announcements`, `notifications`, `push_subscriptions`, `audit_logs`,
  `auth_throttle`, `app_config`, `performance_notes`.

All operational data is **per-branch** via `branch_id`; there is no global inventory.

## 4. App structure
- `src/app/(app)/*` — protected pages (the `(app)/layout.tsx` is the auth gate: no
  session → `/login`; `must_change_password` → `/change-password`; kiosk → `/kiosk`).
  Role/view-mode decide nav (owners can toggle branch/owner view).
- `src/app/api/*` — service-role routes, each caller-verified + rank-gated
  (`create-staff`, `reset-staff-password`, `set-staff-active`, `unlock-login`,
  `agent/chat`).
- `src/lib/` — `supabase/{server,client}.ts`, `auth/rank.ts` (pure role logic, tested),
  `queries/*`, `i18n/*`, `time/*` (Europe/Berlin business-date math), `push/*`, `offline/*`.
- `src/components/*` — UI (BottomNav, charts, toasts, language/theme toggles, AgentChat).

## 5. AI ops assistant (Phase 1)
- **Route:** `POST /api/agent/chat` — flag-gated (`AGENT_CHAT_ENABLED`), manager+ only.
- **Tools (read-only):** `get_stock_levels`, `get_expiry_risk`, `get_waste_trend`.
  They query live tables **through the caller's RLS-scoped session**, so branch scope is
  automatic. The model can only call these three tools — no arbitrary SQL, no writes.
- **Model:** `AGENT_MODEL` env (default current Sonnet), capped reply tokens.
- **UI:** `/assistant` page + `AgentChat` client component, EN/DE.
- **Separate repo:** `schnitzery-ops-agent` holds the fuller framework (bounded tool
  loop, zod registry, guardrails with read/propose/act tiers, Langfuse) for Phase 2
  (background worker, approvals, write/propose). Its read tools are wired to this real
  schema. Not merged into the portal — see ROADMAP.

## 6. Deploy & environments
- `main` → Vercel production; `develop` → staging preview; `feature/*` → per-PR preview.
- CI (GitHub Actions): lint, typecheck, test+coverage, build, audit, + CodeQL and
  gitleaks secret scan. Branch protection requires the CI gate + gitleaks on `main`/`develop`.
- Secrets in `.env.local` (gitignored) + Vercel env: Supabase URL/anon/service-role keys,
  VAPID keys, `ANTHROPIC_API_KEY`, `AGENT_CHAT_ENABLED`, `AGENT_MODEL`.

## 7. Known constraints
- Next 16 is pre-release-ish in conventions — read `node_modules/next/dist/docs/` before
  changing framework-level code (see AGENTS.md).
- Generated DB types (`src/lib/database.types.ts`) are adopted incrementally, not applied
  globally (legacy nullable mismatches) — see `docs/architecture/DB-TYPES-ADOPTION.md`.
