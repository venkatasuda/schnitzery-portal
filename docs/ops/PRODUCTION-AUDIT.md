# Schnitzery Portal — Production Readiness Audit

**Date:** 2026-07-18
**Stack:** Next.js 16.2.7 (App Router, `src/proxy.ts` middleware), React 19.2.4, Supabase (SSR + service role), Sentry, hand-rolled PWA service worker.
**Scope:** static review of all source in `src/`, `public/`, config, and CI. Approx. 190 exported Server Actions across 44 files in `src/lib/queries/`, 2 REST route handlers.

**What I could not check** (stated up front, because it changes the severity of several items):
- The build/tests were not executed — the sandbox was unavailable this session.
- **The database is not in the repo.** No `supabase/migrations/`, no RLS policies, no definitions for `clock_in`, `clock_out`, `sync_attendance_events`, `current_clock_token`, `clock_code_batch`, `record_geo_check`. Most of this app's authorization lives in those policies, so several findings below are "confirmed in app code, severity depends on RLS."

---

## Summary

The app is further along than most pre-launch codebases: auth is checked with `getUser()` (not `getSession()`), writes that must not be forged go through `SECURITY DEFINER` RPCs, the service-role key never reaches the client, there is a CI pipeline, and login throttling exists. Good instincts throughout.

There are, however, **three issues I would not ship without fixing** — a dead-but-live insecure module, a bypassable login throttle, and an authenticated-page cache on shared kiosk tablets. All three have small, non-breaking fixes.

| # | Severity | Issue | Fix risk |
|---|----------|-------|----------|
| 1 | **Critical** | ~~Legacy `profile-uploads.ts` still exports unguarded document actions~~ — **FIXED 2026-07-18, unverified** | Very low |
| 2 | **High** | ~~Login throttle is bypassable — `clearAttempts` is a public Server Action~~ — **FIXED 2026-07-18, unverified** | Low |
| 3 | **High** | ~~Service worker caches authenticated pages on shared devices~~ — **FIXED 2026-07-18, unverified** | Low |
| 4 | **High** | Database schema/RLS not in version control | Medium (process) |
| 5 | Medium | Real staff PII + a shared temp password committed in `seed-stuttgart-team.mjs` | Low |
| 6 | Medium | ~~`getRequiredChecklist(userId)` has no authorization check~~ — **FIXED 2026-07-18, unverified** | Low |
| 7 | Medium | ~~`set-staff-active` — peers can deactivate peers; non-atomic two-step write~~ — **FIXED 2026-07-18, unverified** | Low |
| 8 | Medium | ~~No security headers / CSP in `next.config.ts`~~ — **FIXED 2026-07-18, unverified** (CSP report-only) | Low |
| 9 | Medium | Offline queue trusts device clock — **dead-letter cap fixed**; clock-drift still open, needs the DB | Medium |
| 10 | Low | PWA icons referenced but absent — **precache no longer fails atomically; icons still missing** | Very low |
| 11 | Low | ~~`create-staff` — unvalidated role string, 6-char passwords~~ — **FIXED 2026-07-18, unverified**; rate limit still open | Low |
| 12 | Low | ~~CI does not run lint~~ — **FIXED 2026-07-18**; test coverage improved but still thin | Low |
| 13 | **High** | ~~Queued offline attendance events attributed to whoever syncs them~~ — **FULLY FIXED 2026-07-18** (see correction below) | Medium |
| 14 | **High** | ~~`current_clock_code()` checks a role that doesn't exist and omits two that do~~ — **APPLIED to production DB 2026-07-18, verified** | Very low |
| 15 | **High** | Offline sync computes code validity then ignores it — invalid/absent codes are applied anyway | Low |
| 16 | **High** | ~~Offline `work_date` uses UTC while everything else uses Europe/Berlin~~ — **APPLIED to production DB 2026-07-18, verified** | Very low |
| 17 | **High** | `captured_at` accepted unbounded from the device clock | Low |
| 18 | **High** | `hourly_wage`, `phone`, `email` of every colleague readable by any staff member | Medium |
| 19 | Medium | ~~`contract_hours` / `annual_leave_days` self-editable by staff~~ — **APPLIED to production DB 2026-07-18, verified** | Very low |

> **Status note (2026-07-18):** items 1, 2, 3, 6, 7, 8, 11, 12 and the client/server half of 13 have been fixed in code but **were not verified** — the sandbox was unavailable for this work, so nothing was type-checked, tested or built. Push to a branch and let CI confirm before deploying.
>
> **Update — code merged 2026-07-18.** Items 1, 2, 3, 6, 7, 8, 11, 12, 13 are merged to `main` (commit `bdc6e6e`) and the app was hand-tested (login confirmed working). Lint in CI was made advisory rather than blocking — see the note in `ci.yml`; type-check and build still block.
>
> **Update — database fixes applied 2026-07-18, verified.** Items **14, 16 and 19** were applied to the production database via `supabase/pending/01_safe_fixes.sql` and confirmed by inspecting `pg_proc`. Items 15 and 17 (`02_attendance_enforcement.sql`) were safe to apply because the `attendance_events` table contained **zero offline events** — nothing existing could be rejected.
>
> **Note worth acting on:** that zero is itself a finding. The offline clock-in feature has never successfully recorded anything in production, which is consistent with item 10 — the missing PWA icons make the service-worker precache fail silently, so offline mode never installs. The icons are not cosmetic; they are why a built feature does not run.
>
> **Still open:** item 18 (colleague wage/phone exposure — the most serious remaining), item 5 (purge PII from Git history), item 10 (add the icon PNGs). Items 5 and 10 need shell access or binary assets that could not be produced in these sessions.

---

## 1. Critical — legacy `profile-uploads.ts` is still a live attack surface

`src/lib/queries/documents.ts` was clearly written to replace `src/lib/queries/profile-uploads.ts`. Its comment even says so:

> `// Only signs a URL if the caller can actually see the document row ... closing the open-signing gap.`

**The old file was never deleted, and it is still `"use server"`.** Every export in a `"use server"` file is a publicly reachable POST endpoint with a stable action ID — it does not matter whether any component imports it. And in this case one still does: `src/app/(app)/page.tsx:8` imports `listMyDocuments` from `profile-uploads`, guaranteeing the module is in the production bundle.

Two concrete holes in it:

**a) IDOR on signed URLs** — `profile-uploads.ts:52`

```ts
export async function getDocumentUrl(filePath: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  // no ownership check at all
  const { data } = await supabase.storage.from("documents").createSignedUrl(filePath, 300);
  return { ok: true, url: data.signedUrl };
}
```

Any logged-in staff member can pass any path in the `documents` bucket and receive a working signed URL. That bucket holds passports, visas, residence permits and contracts. Paths are predictable (`<user_id>/...`), and `getDocumentsDashboard` hands `file_path` to managers directly.

**b) Cross-user file deletion** — `profile-uploads.ts:62`

```ts
await supabase.storage.from("documents").remove([filePath]);   // unscoped, runs first
const { error } = await supabase.from("user_documents")
  .delete().eq("id", id).eq("user_id", user.id);               // scoped, runs second
```

The DB row delete is correctly scoped to the caller. The **storage delete is not** — any authenticated user can delete any other employee's document file. The ordering is also wrong: if the row delete then fails, you are left with a DB record pointing at a file that no longer exists.

**Fix (non-breaking):**

1. Point `src/app/(app)/page.tsx` at `@/lib/queries/documents` instead.
2. Delete `src/lib/queries/profile-uploads.ts`, moving `setAvatarUrl` (the only unique, and safe, export) into `documents.ts` or a small `profile.ts`.
3. Storage-level defence in depth: add a Supabase Storage policy on the `documents` bucket restricting reads to `(storage.foldername(name))[1] = auth.uid()::text` OR a manager of that user's branch. Then even a code regression cannot leak files.

**General rule this implies:** treat every `"use server"` export as a public API route. Grep for orphaned ones before each release.

---

## 2. High — the login throttle can be bypassed in one call

`src/lib/queries/loginThrottle.ts` is `"use server"` and exports `clearAttempts(email)`. Server Actions are invocable by ID from any route the app serves — including `/login`, which `proxy.ts` deliberately lets unauthenticated traffic reach.

So the attack is: guess a password → if it fails, call `clearAttempts(victim@…)` → counter back to zero → repeat, unbounded. `checkLogin` also returns `remaining`, which conveniently tells the attacker exactly where they stand.

Two secondary problems in the same file:

- **Throttling is per-email only, with no IP dimension.** Password spraying (one attempt each against 40 staff accounts, rotating) never trips it.
- **It is an account-lockout DoS.** Anyone who knows a manager's email can send 6 bad attempts and lock them out for 15 minutes, repeatedly. During a Friday dinner service that is a real operational outage.

**Fix (non-breaking):**

- Make `clearAttempts` non-exported. Call it from a wrapper action that first verifies the sign-in actually succeeded — or better, fold the whole flow into one `signIn(email, password)` Server Action that checks, authenticates and clears internally, exporting only that. The client never needs the three primitives separately.
- Have the throttle key on `email + client IP` (read from the `x-forwarded-for` header via `headers()`), and separately cap attempts per IP across all emails.
- Drop `remaining` from the response.
- Consider making lockout exponential-backoff rather than hard-block, so the DoS window shrinks.

Supabase Auth also has its own rate limits — worth confirming they are enabled in the dashboard as a backstop, since this file's `try/catch` deliberately fails open (`return { blocked: false }` on any error, `loginThrottle.ts:34`). Failing open is a reasonable availability choice, but it means a throttle-table outage silently removes all brute-force protection. At minimum, log to Sentry when that catch fires.

---

## 3. High — the service worker caches authenticated pages on shared tablets

`public/sw.js` is thoughtfully written and the header comment lists the right safety rules. But the navigation handler does not follow them:

```js
if (req.mode === "navigate") {
  event.respondWith(
    fetch(req).then((res) => putInCache(req, res))   // caches EVERY page, logged in or not
    ...
```

`putInCache` stores the response unconditionally — no status check, no `Cache-Control` check, no auth check. On a kiosk tablet or a shared back-office device this means:

- Employee A views `/timesheet`, `/payroll`, `/staff/[id]` → those rendered HTML pages, containing their personal data, land in the Cache API.
- Employee B uses the same tablet. If the network hiccups, the offline fallback (`caches.match(req)`) serves **A's page to B**.
- The cache survives logout entirely. Nothing clears it.
- Redirects and error responses get cached too, so a cached `302 → /login` can pin a route into a redirect loop until `CACHE_VERSION` is bumped.

**Fix (non-breaking):**

- Restrict navigation caching to an explicit allowlist of shell routes that contain no personal data — realistically `/kiosk` and `/login` only. Let every other navigation go network-only.
- In `putInCache`, bail unless `res.ok && res.status === 200 && res.type === "basic"`, and skip if the response carries `Cache-Control: no-store` or `private`.
- Add `Cache-Control: no-store` to authenticated page responses server-side (see item 8) so this is enforced from both ends.
- Call `caches.delete(CACHE_VERSION)` and clear the offline queue in `LogoutButton` before redirecting.
- Bump `CACHE_VERSION` when you deploy the fix, or existing devices keep serving the old worker.

---

## 4. High — the database is not in version control

The `supabase/` directory contains only `.temp/` CLI state. There are no migrations and no policy definitions.

The security model of this app is largely *in the database*: RLS on `users`, `attendance_logs`, `user_documents`, `stock_transfers`, plus the `SECURITY DEFINER` functions that stamp timestamps and validate clock codes. The application layer is a thin, cooperative wrapper — several actions (`archiveDocument`, `approveDocument`, `transition` in `transfer.ts`) explicitly comment "RLS handles this."

With no migrations you have: no review trail for policy changes, no way to rebuild the environment, no staging that provably matches production, no rollback, and no test that a policy still does what a comment claims. A one-line RLS change made in the dashboard at 11pm is invisible and irreversible.

**Fix:** run `supabase db pull` to capture the current schema, policies and functions into `supabase/migrations/`, commit it, and from then on change the DB only through migrations. Add `supabase db push` to a deploy step. This is the single highest-leverage change on this list, and it is purely additive — nothing breaks.

Once that exists, add a test that asserts RLS is enabled on every table: query `pg_class.relrowsecurity` and fail if any public table is `false`. A missing `ENABLE ROW LEVEL SECURITY` on one table is the classic Supabase production breach, and right now nothing would catch it.

---

## 5. Medium — real staff PII and a shared password in the repo

`seed-stuttgart-team.mjs` contains the full Stuttgart roster: first names, teams, contract types, contract hours and **real mobile numbers** for ~30 people, plus:

```js
const TEMP_PASSWORD = "<redacted — a single shared password for all ~30 staff>";
```

Under GDPR this is personal data of identifiable employees, committed to Git and replicated to every clone and to GitHub. The shared temp password is mitigated by the `must_change_password` flow in `(app)/layout.tsx:30` — but note that flow only gates *page navigation*. A user who has not changed their password can still invoke every Server Action directly, and the `/kiosk` route does not check the flag at all.

**Fix:**
- Move the roster to an untracked CSV (`.gitignore` already covers `.env*`; add `*.roster.csv`), and have the script read it. Generate a unique random password per user and print it once.
- Purge the file from history (`git filter-repo`) if the repo is or will be shared beyond you.
- Add `must_change_password` to the check inside a shared `requireUser()` helper, so it gates actions as well as pages.

---

## 6. Medium — `getRequiredChecklist` has no authorization check

`documents.ts:178` — every other function in this file checks `isManager(role)`. This one takes an arbitrary `userId` and checks only that *someone* is logged in:

```ts
export async function getRequiredChecklist(userId: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", items: [] };
  // no role check, no branch check, no "is this me" check
```

If RLS on `user_documents` and `users` is tight, this leaks nothing. If it is at all permissive, any staff member can enumerate which colleagues are missing a work permit and when everyone's visa expires. Given item 4, I cannot verify which. Add the check regardless — defence in depth costs nothing here:

```ts
if (userId !== user.id && !isManager(role)) return { ok: false, error: "Not allowed.", items: [] };
```

Same treatment for `archiveDocument` (no ownership check in app code) and `approveDocument` / `rejectDocument` (role checked, but branch is not).

---

## 7. Medium — `set-staff-active` rank check and non-atomic write

`src/app/api/set-staff-active/route.ts`

**a) Peers can deactivate peers.** Line 60:

```ts
if ((RANK[target.role] ?? 0) > (RANK[me.role] ?? 0)) return 403;
```

Strictly greater — so `manager` (rank 2) may ban another `manager`, and `branch_owner` may ban another `branch_owner`. Whether that is intended is a business call, but combined with a compromised or disgruntled manager account it lets someone lock out the entire management team of a branch. Consider `>=` with an explicit exemption for `brand_owner`/`super_admin`.

**b) The two writes are not atomic.** Step 5 sets `status`, step 6 sets the auth ban. If step 6 fails you return an error but the status change has already landed — the user shows as "inactive" in the UI while still being able to log in and clock in. The error message admits this. Wrap both in a single Postgres function, or reverse the order (ban first, then status) so the failure mode is "can't log in but looks active," which is the safer of the two.

**c) Lookup uses the admin client.** Line 52 fetches the target with the service-role client, which is correct for cross-branch owners but means the branch check at line 57 is the *only* thing standing between a manager and any user row in the system. It is written correctly today — just be aware it is load-bearing.

---

## 8. Medium — no security headers or CSP

`next.config.ts` is effectively empty:

```ts
const nextConfig: NextConfig = { /* config options here */ };
```

For a production app handling employee records, add:

```ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
      ],
    }];
  },
};
```

Note `camera=(self)` and `geolocation=(self)` — the QR scanner and geofencing need those; do not lock them to `()`.

Add a CSP in **report-only** mode first (`Content-Security-Policy-Report-Only`) and watch Sentry for a week before enforcing. Enforcing a CSP blind is the classic way to break a production app, and the inline `style={{...}}` usage throughout this codebase means `style-src` will need care.

Also worth adding: `Cache-Control: no-store` on authenticated routes (pairs with item 3), and `sentry.tunnelRoute` so ad-blockers stop swallowing your error reports — you will otherwise have a blind spot on exactly the devices that have problems.

**Sentry PII:** `instrumentation-client.ts` has no `beforeSend`. Error payloads will carry employee names, emails and IDs from component props and breadcrumbs, sent to a third party. Add a `beforeSend` scrubber and confirm your Sentry data-residency setting — the DSN is already on `ingest.de.sentry.io`, which is the right region for a German employer.

---

## 9. Medium — offline attendance trusts the device clock

`attendanceQueue.ts:52` — `captured_at: new Date().toISOString()` is device time, and `sync.ts` sends it straight to `sync_attendance_events`.

On a tablet the staff can reach, changing the system clock lets someone backdate or extend a shift. The `code` field is meant to guard this (retro-validation against the rotating code window), which is the right design — but **verify the RPC actually rejects a `captured_at` that is inconsistent with the code's window**, and clamp drift (e.g. reject anything more than a few hours from server time, or store both device time and server receipt time and flag the delta for manager review). This is exactly the kind of logic I cannot check because of item 4.

Two more in the same subsystem:

- **`attempts` is incremented but never acted on.** If the RPC persistently declines to confirm an event, it stays in `localStorage` forever and is re-sent on every flush. Add a cap (say 20) after which the event moves to a dead-letter list and surfaces to a manager rather than retrying silently.
- **`syncOfflineEvents(events: any[])`** (`attendance-sync.ts:8`) has no auth check, no array-length cap and no shape validation before hitting the RPC. Even if the RPC is airtight on identity, add `if (events.length > 200) return error` and a light schema check — an unauthenticated caller can currently hand your database an arbitrary JSON blob of any size.

---

## Database review (added 2026-07-18, after the schema dumps were provided)

The schema and functions were reviewed from `production-schema.sql` and `production-functions.sql`. This replaces the "depends on RLS, cannot verify" hedging in several items above.

### What is genuinely good

Worth stating plainly, because this is better than most Supabase projects reach:

- **RLS is enabled on every table** — I checked all of them.
- **`rls_auto_enable()` is an event trigger that turns RLS on automatically for any new table.** That is the single best defence against the classic Supabase breach (someone adds a table and forgets the policy), and it is rare to see.
- **Every `SECURITY DEFINER` function sets an explicit `search_path`.** That is the standard Postgres privilege-escalation vector and it is closed everywhere, without exception.
- `app_config` (which holds the clock-code secret) and `auth_throttle` have RLS enabled with **zero policies** — deny-all to end users, reachable only by the service role. Correct and deliberate.
- `users_role_check` constrains `role` to exactly the six valid values, so the whitelist added in item 11 matches the database.
- `guard_role_change()` and `guard_users_sensitive_update()` correctly block privilege escalation, including "cannot grant a role above your own".
- Attendance writes go through `SECURITY DEFINER` functions that stamp `now()` server-side; the online `clock_in()` properly *raises* on an invalid code and enforces the geofence.

### Correction to item 13

**My earlier statement was wrong.** I said the RPC needed a server-side owner check. It does not — `sync_attendance_events()` opens with `v_uid uuid := auth.uid()` and uses that for every insert, ignoring any `user_id` the client sends. The database was never the weak point.

The bug was purely client-side: the queue had no owner, so employee A's events were sent under employee B's session and the RPC — correctly, from its point of view — attributed them to B. The fix shipped in the app closes it completely. **No database change is required for item 13.**

---

## 14. High — `current_clock_code()` role list is broken

`production-functions.sql:2219`:

```sql
if v_role not in ('manager', 'franchise_owner', 'brand_owner', 'kiosk') then
  raise exception 'Not permitted.';
```

`franchise_owner` **is not a role in this system** — `users_role_check` allows only `super_admin`, `brand_owner`, `branch_owner`, `manager`, `staff`, `kiosk`. It looks like a rename that was never propagated. Meanwhile the list omits `branch_owner` and `super_admin`, both of which are real.

**Live effect:** a branch owner or super admin calling `getCurrentClockCode()` gets "Not permitted." and cannot show the clock code on the kiosk screen.

The newer `current_clock_token()` (line 2250) does it correctly with `is_manager() or v_role = 'kiosk'`. Fixed in SECTION 1 of the migration by using `is_manager()`, so the list can't drift again.

---

## 15. High — offline sync validates the code, then ignores the result

In `sync_attendance_events()`, step 2 computes:

```sql
v_valid := case when coalesce(v_qr, false) then public.code_valid_at(v_branch, v_code, v_at, 4) else null end;
```

...and step 3 applies the event to `attendance_logs` **without ever reading `v_valid`**. It is written to `attendance_events.code_valid` for audit and otherwise discarded.

Compare the online path: `clock_in()` raises `'Invalid or expired code'` and refuses. So the same branch enforces its QR requirement online and ignores it offline. Anyone able to reach the sync endpoint could post a `clock_in` with no code at all and have it applied to their timesheet.

Fixed in SECTION 3 — but read the note there first and run the counting query, because enforcing this will start rejecting events that were previously accepted.

---

## 16. High — offline attendance is filed in the wrong timezone

`sync_attendance_events()` computes the work date as:

```sql
v_wd := (v_at at time zone 'utc')::date;
```

`clock_in()` uses `(now() at time zone 'Europe/Berlin')::date`. `inventory_purchases.purchase_date` defaults to Berlin. `berlinDate.ts` — the one well-tested module in the app — exists precisely to keep this consistent.

In summer (CEST, UTC+2) an offline clock-out at **00:30 Berlin is 22:30 UTC the previous day**. The shift is filed against the wrong `work_date`, which then drives `duration_mins`, the monthly totals and the payroll export. The staff most affected are the ones closing the restaurant after midnight — who are also the most likely to be on a flaky connection at that hour.

One-word fix, in SECTION 3. Worth checking whether historical rows need correcting:

```sql
select work_date, count(*) from public.attendance_logs
where source = 'offline' group by 1 order by 1 desc limit 30;
```

---

## 17. High — `captured_at` is trusted without bounds

`v_at := (e->>'captured_at')::timestamptz` comes straight from the device clock with no sanity check. Combined with item 15, on a branch where `qr_required = false` there is **no constraint on offline attendance at all** — set the tablet's clock back, clock in, sync, and the hours are recorded.

The rotating code does constrain this when QR is required (you cannot produce a code for a window you weren't present in), which is a good design. But it only bites once item 15 is fixed, and only on branches with the setting on.

SECTION 3 clamps `captured_at` to "not more than 10 minutes in the future, not more than 14 days old". Tune the backdate window to how long a device might plausibly stay offline.

This closes the remaining half of item 9.

---

## 18. High — every employee can read their colleagues' wages

`users_select`:

```sql
USING ((id = auth.uid()) OR (branch_id IN (SELECT accessible_branch_ids())))
```

and `accessible_branch_ids()` returns a staff member's own branch. RLS in Postgres is row-level, not column-level — so a staff member who passes this policy gets **every column** of every colleague's row:

`hourly_wage`, `phone`, `email`, `annual_leave_days`, `contract_hours`, `employee_code`

A single request with their own token returns the branch's entire pay and contact list:

```
GET /rest/v1/users?select=full_name,hourly_wage,phone
```

The app's UI never shows staff this data, which is exactly what makes it dangerous — the exposure is invisible from inside the product and would not turn up in any amount of clicking around.

For a German employer this is the most serious data-protection finding in the system.

**There is no safe one-line fix**, which is why SECTION 4 of the migration is commented out rather than ready to run. Column privileges would also block managers, who legitimately need `hourly_wage` for the labour-cost report (`labor.ts:123`). The proper fix is to move pay into a manager-only `user_pay` table; the migration sketches it with the correct order of operations (create and backfill → repoint the app → verify → only then drop the column).

---

## 19. Medium — staff can edit their own contract hours and leave allowance

`guard_users_sensitive_update()` protects `role`, `branch_id` and `hourly_wage`. It does not protect `contract_hours` or `annual_leave_days`, and `users_update` permits `id = auth.uid()`. Both values feed real calculations — contract hours drive the overtime comparison in `timepay.ts`, leave days drive the balance in `leave-balance.ts`.

Fixed in SECTION 2, which also adds `employee_code`.

Deliberately **not** guarded: `must_change_password`. `ChangePasswordForm.tsx:44` clears it as the user themselves, so guarding it would break the forced-password-change flow. Self-clearing it only skips a prompt on an account they already control.

---

## 13. High — offline attendance events are attributed to whoever syncs them

*Found while fixing item 3. Not yet fixed.*

`attendanceQueue.ts` stores queued clock events in `localStorage` with no record of **who captured them**:

```ts
export type QueuedEvent = {
  event_uuid: string; action: ClockAction; captured_at: string;
  code: string | null; device_id: string; queued_at: number; attempts: number;
  // ← no user_id
};
```

`flushQueue()` sends whatever is in the queue using the **current** session, and `sync_attendance_events` will attribute those events to `auth.uid()` — the person signed in *at sync time*.

On a shared tablet, which is the entire premise of the kiosk: employee A clocks in while the network is down → A logs out → employee B logs in → the queue flushes → **A's clock-in is recorded as B's**. That is corrupted payroll data, and it is silent.

I added a best-effort `flushQueue()` to `LogoutButton` as a partial mitigation, so events normally go up while their owner still holds the session. That narrows the window but does not close it — it does not help if the network is still down at logout, if the tab is closed rather than signed out, or if the session expires.

**Proper fix:**

1. Stamp `user_id` onto each event at capture time in `captureOffline()`.
2. In `flushQueue()`, send only events whose `user_id` matches the current session; leave the rest queued.
3. Have `sync_attendance_events` reject any event whose claimed `user_id` is not `auth.uid()`, so the server never depends on the client getting this right.
4. Surface stranded events (belonging to a user who is not currently signed in) in the `SyncStatus` component so a manager can see them rather than having them sit invisible.

Step 3 is the one that actually matters — steps 1, 2 and 4 are the client being cooperative, but only the RPC can enforce it. This needs the schema in version control (item 4) to do properly.

---

## 10. Low — PWA icons do not exist

`manifest.webmanifest` and `sw.js` both reference `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-512-maskable.png`. **`public/icons/` does not exist** — `public/` contains only the default Next.js SVGs.

Consequences: the install prompt will not fire on Android (a valid icon is required), and — more subtly — `cache.addAll(APP_SHELL)` is atomic, so a single 404 rejects the whole call and **nothing is precached at all**. The `.catch(() => {})` on line 18 hides this completely. The offline kiosk mode you built is therefore not working today, and fails silently.

**Fix:** add the three PNGs, and change `addAll` to per-item `cache.add()` calls with individual catches so one missing asset cannot void the entire precache. Then delete the default `next.svg` / `vercel.svg` / `window.svg` / `globe.svg` / `file.svg`.

---

## 11. Low — `create-staff` hardening

`src/app/api/create-staff/route.ts` is well structured — caller verified, privilege escalation blocked, orphan auth-user cleanup on failure. Some gaps:

- **`newRole` is not validated against a whitelist** (line 36). A manager can pass `role: "kiosk"` or any arbitrary string, which is written straight into `users.role`. Junk roles will fail the `isManager()` checks everywhere and produce a confusing half-broken account. Validate against the known set, and add a `CHECK` constraint on the column.
- **Password minimum is 6 characters** (line 34). Raise to 10+ and check against a common-password list; these are accounts that expose payroll data.
- **`email` is not normalised.** `norm()` exists in `loginThrottle.ts` — apply the same `trim().toLowerCase()` here, or throttle records will not match the accounts they are protecting.
- **No rate limit.** An authenticated manager can create unlimited accounts in a loop.
- **`branch_id: me.branch_id`** (line 74) means a `brand_owner` cannot create staff for a branch other than their own. Probably a real functional gap once you have more than one branch.
- **`body: any`** in both routes. Worth a small validator (Zod or hand-rolled) — you are currently passing unvalidated user input into an upsert.

---

## 12. Low — CI and tests

`.github/workflows/ci.yml` runs vitest → `tsc --noEmit` → `next build`. Good baseline. Gaps:

- **`npm run lint` is never run**, despite the script and ESLint config existing.
- **One test file** (`berlinDate.test.ts`) for 190 Server Actions. Berlin timezone handling is genuinely the right thing to have tested first — DST transitions around shift boundaries are a real payroll bug source — but the authorization logic has no coverage at all.
- No dependency audit step.
- No `concurrency` guard on deploys, and the workflow does not gate the Vercel deployment (Vercel builds independently of this).

**Suggested additions**, in priority order:

1. Tests for the role/rank matrices in `set-staff-active` and `create-staff` — pure functions, easy to extract and assert, and they encode your actual security rules.
2. A test asserting no `"use server"` file exports something unreachable from the UI (catches item 1 recurring).
3. `npm audit --audit-level=high` and `npm run lint` as CI steps.
4. An RLS-enabled assertion test (see item 4).

---

## Suggested order of work

**Before deploy — these are the blockers:**

1. Delete `profile-uploads.ts`, repoint `(app)/page.tsx` (item 1)
2. Un-export `clearAttempts`, add IP dimension to the throttle (item 2)
3. Restrict the service worker's navigation cache, clear caches on logout, bump `CACHE_VERSION` (item 3)
4. `supabase db pull` and commit the schema (item 4)
5. Add the PWA icons — your offline kiosk mode does not currently work (item 10)

**First week after:**

6. Add the missing authorization checks (item 6) and `requireUser()` including `must_change_password`
7. Security headers, CSP in report-only, Sentry `beforeSend` scrubbing (item 8)
8. Purge PII from the seed script and Git history (item 5)
9. Verify the `sync_attendance_events` clock-drift handling (item 9)

**Ongoing:**

10. Rank-check semantics and atomicity in `set-staff-active` (item 7)
11. Input validation on both API routes (item 11)
12. Lint in CI, tests around the authorization matrices (item 12)

Every item above is additive or a deletion of dead code. None of them change a working user-facing flow, with one exception: restricting the service worker cache (item 3) will make some previously-cached pages stop loading offline — which is the intended outcome, since they should never have been available offline on a shared device.

---

## What is working well

Worth saying plainly, because these are the things people usually get wrong:

- `auth.getUser()` everywhere rather than `getSession()` — this is the correct call and a very common mistake.
- The service-role key is confined to server-only modules and never crosses into a client component.
- Timestamps are stamped by `SECURITY DEFINER` DB functions, not the client. That is the right architecture for attendance data, where the user has a financial incentive to lie.
- The clock-code secret was moved out of the app source into the database — the comment in `clockcode.ts` documents that migration, and it was the right call.
- Deactivation bans the auth user rather than deleting the row, preserving history for labour-law record-keeping.
- Orphan-cleanup on failed staff creation, with the failure logged rather than swallowed.
- Berlin-timezone handling is centralised and tested.
- CI exists and gates on type-check plus a real production build.
