# Schnitzery Portal — Engineering Rules & Conventions

_Human-readable conventions. The machine-facing rules live in `CLAUDE.md` / `AGENTS.md`;
this doc explains the "why" and the ones humans must follow too. Don't duplicate — if a
rule changes, update both._

## Security (non-negotiable)
1. **Never trust the client for permissions.** Every branch-scoped table has RLS; every
   `src/app/api/*` route verifies the caller's session and rank **before** using the
   service-role key. Add a new privileged route the same way (`unlock-login` is the model).
2. **Service-role key is server-only.** Never ship it to the browser, never put it in a
   `NEXT_PUBLIC_*` var.
3. **Attendance is server-stamped.** Don't add a client path that writes worked hours.
4. **Derive identity from the verified session**, never from request-body fields.
5. **Scope by branch.** New operational tables need `branch_id` + the standard SELECT/write
   RLS policies. No global operational data (inventory especially is per-branch).
6. **Don't commit secrets.** `.env.local` is gitignored; gitleaks runs in CI. Credential
   HTML / demo credentials stay out of git.

## Framework
7. **This is Next.js 16, not the one you remember.** Read `node_modules/next/dist/docs/`
   before touching framework-level code. Middleware is `proxy.ts`. Favor RSC + Server
   Actions; keep client components lean.
8. **TypeScript strict.** No `any` escapes at trust boundaries. Adopt generated DB types
   incrementally in new code (`DB-TYPES-ADOPTION.md`); don't globally apply `<Database>`.

## i18n
9. **Every user-facing string is bilingual.** Add keys to **both** `en` and `de` in
   `src/lib/i18n/messages.ts`. Missing keys fall back to English — acceptable temporarily,
   not a shipping state.

## Time & correctness
10. **Business dates are Europe/Berlin.** Use the `src/lib/time/*` helpers for week-start /
    work-date math; don't use raw local/UTC dates for roster/analytics.

## Git / release
11. Feature → `develop` (staging) → `main` (production). One feature = one `feature/*`
    branch = one PR. Never commit directly to `main`/`develop`. See `docs/ops/BRANCHING.md`.
12. `main` is always deployable; a red `main` is priority #1.
13. Dependency majors get their own PR, tested on `develop`. **Never** `npm audit fix --force`
    casually — it bumps majors and breaks the build.

## Data changes
14. Schema changes via Supabase migrations (`apply_migration`), not ad-hoc `execute_sql`
    (which is read-only here anyway). Data seeds live in `scripts/ops/*.sql` and are
    idempotent + tagged so cleanup is safe. Real operational data is **untagged** so the
    demo-cleanup script never touches it.

## AI assistant
15. Read-only stays read-only. The agent may only call its registered tools — never give it
    arbitrary SQL. Any write/propose capability goes through the Phase-2 approval queue with
    a dedicated SELECT/limited DB role, never the portal service key.

## Testing
16. Security-boundary logic (role rank, RLS assumptions, attendance) must have tests
    (`rank.test.ts` is the pattern). Don't weaken a test to make a build pass.
