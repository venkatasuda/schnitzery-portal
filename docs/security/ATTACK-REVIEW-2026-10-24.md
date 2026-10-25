# Attack review — 2026-10-24

## Status (same day)
| Finding | Fixed by |
|---|---|
| A1, A2 | Sign-in runs on the server (`loginThrottle.signIn`, the only export); a lock also bans the auth user for 15 min, so Supabase itself refuses the password; unlock / password reset lift the ban (never a deactivation ban). |
| B1, B4 | Migration `20261024200000_security_hardening.sql`: users guard trigger + WITH CHECK; `rank.ts` strictly-lower for everyone but super admin; brand owners can no longer create brand owners. |
| B2 | Same migration (`user_pay` write policy, `set_wage_effective`) + `setStaffWage` self/rank check. |
| B3 | Same migration (own shifts, corrections, leave, swaps) + `setAttendanceApproval`. Brand owner / super admin may approve their own (nobody ranks above them). |
| C1–C8 | Same migration (policies + checklist trigger). |
| D1, D2 | Same migration (`geo_checkpoint` own shift only; internal helpers service-role only). |
| E1 | `readAll` in the Monday summary, monthly overtime and compliance (compliance now errors instead of "no issues" on a failed read). |
| E2, E3, E4 | UUID/body guard in the 3 staff routes; 1,000,000 € daily sales cap; generic assistant error. |
| Checks | `scripts/checks/security-hardening.cjs` (PGlite, runs the real migration, ~40 attack attempts) in CI; `rank.test.ts` updated. |

**Still open / your decision:**
- **Supabase dashboard (5 min):** Auth → Rate limits: lower sign-ins per IP; Auth → Attack protection: turn on CAPTCHA (Cloudflare Turnstile, free) — the only defence against password guessing aimed straight at Supabase Auth. Needs a small change in `signIn` to pass the captcha token; ask when enabled.
- **C9 / inventory follow-up (2026-10-25):** transfer workflow guards are present in production. Batch tampering is closed by `20261025062639_inventory_batch_hardening.sql`, applied and verified in production: quantity/identity/expiry edits are denied, status-only legacy use is guarded, and atomic use/discard RPCs enforce active-account/branch authorization with closure evidence. The attack/rollback check is `scripts/checks/batch-hardening.cjs`; the real PostgreSQL fixture is `supabase/tests/inventory_batch_hardening.sql`.
- **D3** kiosk future-token batch: needs a decision on how long a kiosk must work offline.
- **A3** (skipping the forced password change) accepted: only the person and their manager know the temp password.
- A locked person who is *already signed in* keeps their session until it expires (≤ 1 h); kicking them out would let an attacker log the owner out with 3 wrong guesses.

Method: read every API route, the login flow, the server actions touched recently, and the
RLS policies / SECURITY DEFINER functions in the production schema export
(`.audit-db/local-staging/schema-only.sql`, 21 Oct). Key point for every finding below:
**the browser holds the user's Supabase session and the anon key is public**, so anyone
logged in can call the database REST API directly — server-action checks do not protect
anything that RLS allows. Status: found by reading; confirm each on local staging with the
probe list at the end before fixing.

Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low

## 1. Authentication

**🔴 A1 — Login throttle and account lock can be bypassed.**
`loginForm.tsx` calls `checkLogin()` → `supabase.auth.signInWithPassword()` **in the browser**
→ `recordFail()`. An attacker skips the form and posts straight to
`/auth/v1/token?grant_type=password` with the public anon key: no 3-try limit, no lock.
`users.login_locked` is never checked after sign-in, so a "locked" account still logs in.
*Fix:* move sign-in into a server action (check → sign in with the SSR client → record),
keep `recordFail` internal (not exported), and in `(app)/layout.tsx` sign out + redirect when
`login_locked` is true. In Supabase → Auth → Rate limits, lower sign-in attempts per IP, and
turn on the free CAPTCHA (Cloudflare Turnstile) for sign-in.

**🟡 A2 — Anyone can lock any account.** `recordFail(email)` is a public endpoint; posting an
owner's email every few minutes keeps them locked out (auto-unlock never triggers).
*Fix:* goes away with A1 (record only after a real failed attempt on the server).

**⚪ A3 — Forced password change can be skipped.** A user can set
`must_change_password=false` on their own row via REST. *Fix:* include it in the guard trigger
(only service role may change it; clear it inside a SECURITY DEFINER `complete_password_change()`).

## 2. Privilege escalation (direct REST calls)

**🔴 B1 — A manager can move themselves into any branch.** Policy `users_update` allows
`id = auth.uid()` with no WITH CHECK, and `guard_users_sensitive_update` lets rank ≥ 2 change
`branch_id`. `PATCH /rest/v1/users?id=eq.<me> {"branch_id":"<other>"}` → `accessible_branch_ids()`
now includes that branch: staff data, wages, payroll of a branch they don't belong to.
*Fix (trigger):* nobody may change their **own** `role, branch_id, contract_hours,
annual_leave_days, employee_code, login_locked, status, must_change_password`; when changing
someone else, `new.branch_id` must be in `accessible_branch_ids()`.

**🟠 B2 — Managers can raise their own wage.** `user_pay_mgr` allows writes when
`user_in_my_branches(user_id)` — true for yourself. Same gap in the `setStaffWage` server
action (no self / rank check). *Fix:* policy + action: `user_id <> auth.uid()` and target rank
strictly below caller (owners excepted for staff/managers).

**🟠 B3 — Managers can edit and approve their own shifts.** `att_manage` (ALL) has no
`user_id <> auth.uid()`; a manager can change own clock times / duration and set
`approval_status='approved'`. *Fix:* add `user_id <> auth.uid()` to the write policy (owner
approves managers) and the same check in `setAttendanceApproval`.

**🟠 B4 — Equal-rank takeover.** `canActOnUser` lets brand owners act on other brand owners
(reset password → take over the account); DB `guard_role_change` lets a manager demote another
manager. *Fix:* strictly-lower rank for everyone except `super_admin`; only `super_admin` may
create `brand_owner`.

## 3. Staff can tamper with records (policies with no role/ownership check)

| | Table / policy | What a staff member can do | Fix |
|---|---|---|---|
| 🟠 C1 | `swap_requests.swap_write` (ALL) | approve their own shift swap | insert own only; update status manager-only |
| 🟡 C2 | `cover_requests.cover_update` | accept/alter anyone's cover request | requester or manager |
| 🟡 C3 | `incidents.incident_write` (ALL) | edit or **delete** incident reports | insert any, update/delete manager-only |
| 🟡 C4 | `audit_logs.audit_insert` | write fake audit entries | insert only via trigger / `actor = auth.uid()` |
| 🟡 C5 | `checklists.checklist_write` (ALL) | tick/delete any checklist (inflates health score) | tick own; delete manager-only |
| 🟡 C6 | `certifications.cert_write` (ALL) | edit/delete colleagues' certificates | manager-only writes |
| ⚪ C7 | `availability.avail_write` (ALL) | change colleagues' availability | `user_id = auth.uid()` or manager |
| ⚪ C8 | `shift_broadcasts.broadcast_write` | post/alter shift broadcasts | manager-only |
| 🟡 C9 | `stock_transfers.transfers_update` | change any column of a transfer of their branch | status changes via existing RPC only |

## 4. Database functions callable by anyone (granted to `anon`)

**🟡 D1 — `geo_checkpoint(log_id, lat, lng)`** has no caller check: anyone with a log id can
mark someone else's shift as "outside geofence". *Fix:* `where id = p_log_id and user_id = auth.uid()`; revoke from anon.
**⚪ D2 — `resolve_kiosk`, `notification_sweep`, `notify`, `sync_user_pay_branch`,
`handle_new_user`** are internal helpers but executable by anon (fake kiosk heartbeat keeps a dead
kiosk "online"; sweep spam). *Fix:* `revoke execute … from anon, authenticated`.
**⚪ D3 — `clock_token_batch` hands out up to 1,000 future tokens (8 h).** Anyone who reads the
kiosk's network traffic can clock in remotely later. Cap to what the offline kiosk really needs.
`clock_code_batch` still lists the old role `franchise_owner` and misses `branch_owner`.

## 5. Crashes and wrong numbers

- **🟡 E1 — Silent 1,000-row cap.** Supabase returns max 1,000 rows. The Monday summary cron
  (all-time pending shifts, 2 weeks of sales for all branches), `getMonthlyOvertime` and
  `getCompliance` don't page, so a big branch gets wrong totals without an error.
  *Fix:* `readAll(...)` or `count: "exact", head: true`.
- **⚪ E2 — 500 on `null` body.** `POST /api/set-staff-active|reset-staff-password|unlock-login`
  with body `null` → `TypeError` (destructuring). *Fix:* `if (!body || typeof body !== "object")` → 400; validate `userId` as UUID.
- **⚪ E3 — No upper limit on sales.** `setDailySales` / `importDailySales` accept 1e15 € →
  breaks every percentage and chart. *Fix:* cap (e.g. 1,000,000 € per day).
- **⚪ E4 — Assistant leaks provider errors** (`e.message` returned to the client). Return a generic message, log the detail. (Feature is off by default.)

## Probe list (local staging only, synthetic accounts)
Run each as the named test user with `fetch` to `http://127.0.0.1:55321/rest/v1/...` and the
user's access token; expected result after fixes = 401/403 or 0 rows changed.
1. manager A: `PATCH users?id=eq.<self>` `{branch_id: B}` (B1)
2. manager A: `PATCH user_pay?user_id=eq.<self>` `{hourly_wage: 99}` (B2)
3. manager A: `PATCH attendance_logs?user_id=eq.<self>` `{approval_status:"approved"}` (B3)
4. staff A: `PATCH swap_requests?id=eq.<own>` `{status:"approved"}` (C1)
5. staff A: `DELETE incidents?id=eq.<any>` (C3); `POST audit_logs` (C4)
6. no login: `POST rpc/geo_checkpoint` (D1), `POST rpc/notification_sweep` (D2)
7. no login: 10 × `POST /auth/v1/token?grant_type=password` with a wrong password, then the right one (A1)
