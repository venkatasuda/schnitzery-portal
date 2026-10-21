# Release runbook — offline + roster integrity (`e5b7d46`)

Owner: lead. Status 2026-10-21: review done, F1/F2 production gates **PASSED**.
Production steps are run by someone with Schnitzery DB + GitHub access (this
session's DB connector only exposes FarmersFresh).

## Why this order (migration first, then app)
- **Migration first is backward-compatible.** The live app (`94614db`) keeps
  working: online clocking is untouched; offline events from the old app go to
  manager review instead of auto-adding hours (evidence kept, nothing lost).
- **App first would break.** The new review screen reads `offline_attendance_issues`,
  which only exists after the migration.
- **Vercel previews use the production database.** So the migration must be live
  *before* the branch is merged anywhere that builds a preview.

## Update — branch head is now `a9f3c28` (reviewed, clean)
`a9f3c28` (2026-10-21) adds owner-scoped manual retry of exhausted offline
records, an isolated local-staging launcher, and excludes `.audit-db` from the root
typecheck. Reviewed: no findings; `offline-client.cjs` and `local-staging.cjs` pass.
It does not touch the migration, so the gates and rollback script still apply.
**Local staging now runs** (schema-only baseline, migration applied locally, six
synthetic accounts, eleven checks pass incl. roster compare-and-swap → **F4 cleared**).
That makes Step 0b below mandatory before any production step.

## Step 0b — Staging browser pass (before production)
On the local staging app (`http://schnitzery.localhost:3100`, synthetic accounts
only — see `docs/ops/LOCAL-STAGING.md`):
1. Employee: clock in/out online; go offline (DevTools → Network → Offline), clock,
   reconnect → record syncs; reload while offline → offline page, no private data.
2. Account switch on the same browser with an unsent record → never attributed to
   the second user; the first user's record stays theirs.
3. Manager: offline review list shows an errored record; add a note; employee sees it.
4. Roster: edit + save; second tab saves stale copy → "changed elsewhere", draft kept.
5. Same flows in German and at phone width (390px); keyboard Tab/Escape on dialogs.
Record pass/fail per item in `AUDIT-STATUS.md`.

## Step 0 — Final pre-flight (2 queries, read-only)
Re-run `scripts/ops/preapply-verify-offline-migration.sql` (two queries were added):
- `F2 sync_attendance_events signature` must be **PASS**.
- `save_this_for_rollback` → copy the output into a local file (e.g.
  `rollback-capture.sql`, do **not** commit it). That is the exact rollback source.

## Step 1 — Local checks (Windows, repo root)
```powershell
npm test -- --coverage
npx tsc --noEmit
npm run build
```
All green, or stop.

## Step 2 — Commit + push only real changes
The working tree is Codex's commits plus these files. Everything else that shows
"modified" in a Linux/WSL view is line-ending noise.
```powershell
git add docs/ROADMAP.md docs/ops/REVIEW-e5b7d46.md docs/ops/RELEASE-e5b7d46.md `
        scripts/ops/preapply-verify-offline-migration.sql scripts/ops/rollback-offline-migration.sql
git commit -m "docs(ops): review, pre-apply gates, release + rollback for offline integrity"
git push -u origin codex/offline-roster-integrity
```
Do **not** commit: `tsconfig.agentcheck.json`, `.env*`, `.audit-db/`, `.vercel/`,
`rollback-capture.sql`, regenerated `graphify-out/*`.
Open a PR → `develop`. Wait for CI gate + gitleaks + CodeQL green. **Do not merge yet.**

## Step 3 — Apply the migration (production)
Supabase → Schnitzery project → SQL editor → paste the full contents of
`supabase/migrations/20261017160350_offline_attendance_integrity.sql` → Run.
It is wrapped in `begin; … commit;` — any failure rolls everything back.
Then keep migration history consistent (SQL-editor applies don't record it):
```sql
insert into supabase_migrations.schema_migrations(version, name)
values ('20261017160350', 'offline_attendance_integrity')
on conflict do nothing;
```
Re-run the pre-apply script: the `applied?` row must now say **ALREADY APPLIED**.

## Step 4 — Merge to develop, then main
Merge the PR → `develop` (preview builds; it's the prod DB, so read-only looks
only). Then PR `develop` → `main`, CI green on the exact head, merge → Vercel
deploys production.

## Step 5 — Production smoke test (non-destructive)
No fake payroll, wages or attendance.
1. Manager login → Attendance hub → offline review list **loads** (empty is fine).
2. Roster → current week → **Save without changes**, then **Save again** — both
   succeed, no "changed elsewhere". (Clears F4; identical re-save changes nothing.)
3. Employee login → home/clock screen loads; normal clocking works (only clock a
   real shift).
4. Hard-refresh once so the new service worker (`schnitzery-v5`) installs.

## Rollback
- **App misbehaves:** Vercel → promote the previous production deployment
  (`94614db`). Leave the migration — it's compatible with the old app.
- **Migration must go:** `scripts/ops/rollback-offline-migration.sql` with the
  Step 0 capture pasted into STEP 2. Export `attendance_event_reviews` first.

## Deferred (tracked, not blocking this release)
- Full offline browser test (disconnect → clock → reconnect → account switch) —
  needs staging, or a demo account with explicit cleanup.
- **F5:** Web Locks required for offline capture — confirm kitchen devices are on
  Safari/iOS ≥ 15.4 or add a fallback.
- **F3:** batch-abort on tampered events is a deliberate, tested choice; revisit
  only as a team decision.
