# Independent review — `94614db..e5b7d46` (offline + roster integrity)

Reviewer pass 2026-10-21. Scope: the 33-file diff (829+/314−). Read-only review;
no code changed, nothing deployed, migration not applied. Evidence from source +
the repo's own check scripts (run below). PGlite checks are isolated fixtures, not
the production schema — schema/RLS must still be verified on the real project.

## Verdict
Well-built, defensively coded, and the integrity goals hold in isolated tests.
No data-loss or authorization defects found in the changed code. Ship **after**
the four pre-deploy gates below — two of them are schema checks that can only be
done against the real project.

## Checks run during this review (all passed)
```
node scripts/checks/offline-client.cjs      # ownership, account change, quota, corruption, locks, retries, batching
node scripts/checks/offline-database.cjs     # replay ownership, idempotency, QR, chronology, Berlin date, review RLS (PGlite)
node scripts/checks/roster-integrity.cjs     # role/branch/staff/time + compare-and-swap
node scripts/checks/service-worker.cjs       # redirect/private precache blocked, public offline fallback, cache scoping
node scripts/checks/workspace-ux.cjs         # failure/search/dialog, labour coverage, role/input boundaries
```
Not re-run on this mount (heavy): full `npm run build`, `tsc --noEmit`, `vitest`.
Run those before release.

## Findings

### F1 — Pre-apply gate: the one-open-shift unique index can abort the migration (Med)
`create unique index attendance_one_open_shift ... where status in ('active','on-break')`
fails if any user currently has 2+ open shifts. The "preflight found none" note was
**local**. Run this against production first and resolve any hits before applying:
```sql
select user_id, count(*) from public.attendance_logs
 where status in ('active','on-break') group by user_id having count(*) > 1;
```

### F2 — Verify schema + RLS on the real project before apply (Med)
The migration and the `offline_attendance_issues` (security_invoker) view assume:
`attendance_events(event_uuid,user_id,branch_id,device_id,action,captured_at,source,code,code_valid,sync_status,attendance_log_id,error)`,
`attendance_logs(device_id,source,breaks jsonb,duration_mins,approval_status)`,
functions `public.code_valid_at`, `public.is_manager`, `public.accessible_branch_ids`,
and **existing select RLS on `attendance_events`** (invoker view returns only what the
caller may read). Confirm all exist in prod; the diff can't prove it.

### F3 — Batch poison-pill: one bad event aborts the whole 100-event batch (Low-Med)
Per-event *apply* errors are correctly caught and recorded (`recorded_with_error`).
But the top-level validation and the owner/identity-conflict checks use
`raise exception`, which aborts the entire `apply_events` call — so a single event
with an owner mismatch or a UUID collision with a different payload fails the whole
batch, nothing is acknowledged, and the client retries it forever (queue can't
drain). Aborting on tampering is defensible, but consider demoting owner-mismatch /
identity-conflict to a per-event `recorded_with_error` so one row can't stick a
user's queue. Client sends only its own events, so in practice this needs
corruption/tampering to trigger.

### F4 — Roster compare-and-swap: confirm jsonb equality in staging (Low-Med, verify)
`saveRoster` guards with `.eq("roster_data", JSON.stringify(expected.roster))`. This
is `jsonb = text::jsonb` (semantic equality), so key order/whitespace shouldn't cause
false conflicts — but this is exactly the handoff's "verify roster JSON equality
through actual PostgREST" item. In staging, do two sequential saves and a concurrent
save; confirm the legitimate second save succeeds and only a real concurrent change
yields "changed elsewhere". Draft is preserved on conflict (no data loss) — good.

### F5 — Web Locks is a hard requirement for offline capture (Med, device-dependent)
`attendanceQueue.updateQueue` throws if `navigator.locks` is absent, so capture /
remove / bump all fail on browsers without the Web Locks API (older Safari/iOS
< 15.4, some embedded WebViews). If any kitchen device is on an older browser,
offline attendance is fully broken there. Decide: add a best-effort no-lock
fallback, or document a minimum browser and verify the fleet.

### F6 — In-memory queue owner blocks offline cold-start until identity resolves (Low, by-design)
Queue owner moved from localStorage to a module variable (reset each page load);
`captureOffline` throws "identity not confirmed" until `setQueueOwner` runs. On an
offline cold start before auth hydration, a clock tap errors. This is a deliberate
anti-misattribution trade — confirm `setQueueOwner` is called early and the message
guides the user to wait/reload.

### F7 — duration_mins is gross on the offline path (Info, no action)
Offline `clock_out` stores `duration_mins` as clock_in→clock_out (breaks not
deducted). This matches the rest of the app; pay uses `pay/calculations.shiftMinutes()`
which recomputes from the interval and deducts breaks, and offline breaks are stored
in `breaks`. Analytics paths that read raw `duration_mins` are gross by design/label.

## Strengths worth keeping
Empty-`search_path` definer function + invoker wrapper; strict event sanitization
(UUID/ISO/protocol/finite); per-event error capture; legacy evidence retained for
review, never discarded or re-attributed; branch-scoped immutable review RLS;
roster CAS rebuilds names server-side (no client spoofing) and preserves the draft
on conflict; SW excludes redirected/private responses, serves a public bilingual
offline fallback, and scopes cache cleanup to `schnitzery-` keys.

## Pre-deploy gates (do these, in order)
1. F1 preflight query on production — resolve duplicates.
2. F2 schema + `attendance_events` RLS verification on production.
3. Apply migration in **staging**, then browser-test: offline clock cycle →
   reconnect → replay; manager review of an errored event; two sequential roster
   saves + one concurrent (F4); offline cold start (F6).
4. Decide F5 (Web Locks fallback vs documented minimum browser).
Then `npm run build` + `tsc` + `vitest`, release via develop→main with exact-head CI.

## Follow-up commit `a9f3c28` — reviewed 2026-10-21, no findings
- `retryOwnEvents()` resets attempts only for the confirmed owner's exhausted
  records; never adopts legacy (ownerless) records, never touches another user's,
  preserves `captured_at`; refuses if identity is unconfirmed or changes mid-write.
  Covered by new assertions in `offline-client.cjs` (passes). UI button shows only
  for own records while online; EN+DE strings present.
- Staging launcher refuses any DB other than `http://127.0.0.1:55321` (rejects the
  production URL), blanks AI/Sentry/VAPID keys; `local-staging.cjs` passes.
- `tsconfig.json` excludes `.audit-db` — correct; also explains slow root typechecks.
- Effect on F3: retry gives users a recovery path for stranded records. And F3's
  poison case is practically unreachable from the real client (sync only sends the
  caller's own events with `user_id` set to the caller; retry preserves capture), so
  it remains a tamper-only edge. F4 is now cleared by the staging roster CAS check.

## Lead actions taken — 2026-10-21
- **F1/F2 turned into a runnable script:** `scripts/ops/preapply-verify-offline-migration.sql`
  (read-only). Run it against staging, then the real Schnitzery project; every row
  must say PASS before applying the migration. This replaces the prose gates.
- **F3 investigated and deliberately NOT changed.** I prototyped demoting
  owner-mismatch/identity-conflict to a per-event `recorded_with_error`, but the
  `offline-database.cjs` check asserts owner-mismatch must hard-reject — i.e. the
  team chose "tamper = abort the batch" on purpose and tested it. I reverted to the
  reviewed version (migration now byte-identical to `e5b7d46`). F3 stays a noted
  trade-off: a corrupt/foreign sibling event can push a batch to MAX_ATTEMPTS and
  strand its legitimate siblings for manual review (bounded, not infinite). Revisit
  only as a team decision, with the check updated to match.
- **Blocked (not by me): production reads.** The connected Supabase account exposes
  only **FarmersFresh** (`bjevoybwufubtprkxbvb`), not Schnitzery
  (`vxwtmtlkwvwcdegtcjuz`). I did not run anything against FarmersFresh. To clear
  F1/F2 someone must either grant this session access to the Schnitzery project, or
  run `preapply-verify-offline-migration.sql` in the Schnitzery SQL editor and share
  the PASS/FAIL rows.
- **Still blocked on environment:** F4 (two sequential roster saves) and the offline
  browser/role tests need staging up (Docker). Not doable from here.
