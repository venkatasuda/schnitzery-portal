# Continue here — session handoff

Short state note so a fresh chat can pick up exactly where we left off.
Read this file first, then check `git status` for anything uncommitted.

## ⚠ Do this first
Nothing below was compiled this session (build sandbox was down). **Run a build
before trusting any of it:**
```
cd E:\Schnitzery
npm run build
```
Paste any red errors to fix. Then commit + deploy.

## Done this session (code on disk, NOT yet built/committed)

1. **Login lockout — 3 strikes → manager unblock**
   - `src/lib/queries/loginThrottle.ts` — MAX_EMAIL = 3; sets `login_locked` on 3rd fail; checks it first in `checkLogin`.
   - `src/app/api/unlock-login/route.ts` — new manager-gated unlock route (same rank rules as remove/reactivate).
   - `src/app/(app)/staff/page.tsx` — 🔒 Locked badge + 🔓 Unlock button.
   - `src/app/login/loginForm.tsx` — shows "ask your manager" when locked.
   - `supabase/pending/07_login_lock.sql` — column + guard trigger. **APPLIED to DB.**

2. **Dashboard charts (recharts, already a dependency)**
   - `src/components/dash/Charts.tsx` — new: ProgressRing, DonutStat, MiniBars, RankBars, Legend (theme-aware, light/dark).
   - `src/app/(app)/page.tsx` — staff target ring; manager attendance donut + labour/food-cost rings + waste-trend bars; HQ waste-by-branch ranked bars.
   - `messages.ts` — `home.wasteTrend` (EN/DE).

3. **Push notifications — code complete**
   - Client/server/SW/table/toggle already existed; `web-push` installed.
   - `src/lib/queries/announcements.ts` — now pushes to branch members on post.
   - `src/components/ProfileSettings.tsx` — toggle strings i18n'd.
   - `messages.ts` — `settings.notif*` keys (EN/DE).
   - `supabase/pending/05_push_subscriptions.sql` — **APPLIED to DB.**
   - VAPID keys are in `.env.local`. **Still need the same 4 in Vercel env, then rebuild** (NEXT_PUBLIC_ is baked at build time).

4. **Contact privacy** — Option 1 chosen + recorded in `supabase/pending/06_contact_privacy.sql`.

5. **Motion layer** — `src/app/globals.css` (staggered fade-up, hover/press, reduced-motion guard).

## Pending / next options
- `npm run build` + commit + deploy (required).
- Add VAPID keys to Vercel; test push on a phone (Profile → toggle → accept → post an announcement).
- Optional features discussed: expiring-docs push; charts on `/analytics` and `/labor`; one-tap reorder (getPurchaseOrderDraft already exists); German labour-law compliance flags; inventory anomaly alerts.
- Harden: `.catch()` on the waste queries in `page.tsx` Promise.all so one failed widget can't 500 the dashboard; add tests for payroll / attendance / auth (only `rank.test.ts` exists today).

## Deferred design decision — multi-branch owners (MVP: skeleton only)
One owner owns ~9 branches (exact set unknown yet). The DB already supports this:
`user_branches` (M:N) + `accessible_branch_ids()` grant a branch_owner/manager
extra branches beyond their home `branch_id`. Currently `user_branches` is EMPTY,
so everyone is single-home-branch; `brand_owner` sees ALL branches company-wide.
MVP stance: leave as-is; demo the all-branches view via a brand_owner account.
STEP 2 (when ownership is known): (a) populate `user_branches` for that owner,
(b) branch-owner dashboards must aggregate/switch across `accessible_branch_ids()`
instead of the single home branch, (c) scope `brand_owner` to `franchises`
(branches.franchise_id exists) so franchisees don't see each other's numbers.

## Live DB changes already applied this session (project vxwtmtlkwvwcdegtcjuz)
- Guard trigger fixed (dropped hourly_wage ref), branches.code added.
- Stuttgart branch code = STG; all 20 real staff renumbered STG-001..020.
- Pritesh = STG-012 (kitchen staff). Daniel (STG-021) created as Stuttgart manager
  (auth user 1a3d0885-..., must_change_password=true).
- Security scan (Supabase advisors) done: revoked public EXECUTE on notify() /
  notify_system_error() (was a notification-spoofing vector); pinned search_path on
  attendance_break_mins/distance_m/role_rank; dropped users_hourly_wage_backup_20260718.
  Verdict: no data leaks (RLS on all tables), no RBAC holes (grant_clock_override &
  decide_attendance_correction self-check is_manager+branch). STILL TODO (user, dashboard):
  enable Auth leaked-password protection. Perf advisories (unindexed FKs, RLS initplan,
  duplicate policies) are scale-only — defer.

## Decisions on record (not bugs)
- Shared seed password NOT rotated — user's choice (repo is private).
- Contact-privacy Option 2 (DB-level) deferred — see `06`.
- **Supabase connector is scoped to a different project ("FarmersFresh"), NOT Schnitzery.** Migrations must be run by hand in the Schnitzery SQL editor. Don't apply Schnitzery SQL through the connected project.
