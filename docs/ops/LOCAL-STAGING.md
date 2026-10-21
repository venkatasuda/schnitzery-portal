# Local staging

Local database/API setup verified 2026-10-21. Full browser workflow review remains
pending; this is not sign-off for a production release.

| Resource | Dedicated location |
| --- | --- |
| Work directory | `.audit-db/local-staging/` (ignored) |
| Supabase project ID | `schnitzery-local-staging` |
| API / database | `127.0.0.1:55321` / `127.0.0.1:55322` |
| Intended portal | `http://schnitzery.localhost:3100` |
| App source snapshot | `.audit-db/local-staging/app/` |

Docker engine 29.9.1 is responding. Five dedicated services are running. A valid
schema-only export (47 tables, no business-row INSERT/COPY statements) was imported
transactionally; the offline migration was applied locally only. Six synthetic
accounts span two test branches. Eleven checks against actual local Auth,
PostgREST, RLS and copied production triggers pass, including roster JSON
compare-and-swap and cross-branch write denial. The login page returned HTTP 200
and rendered in the browser. Full UI workflows, offline/disconnection, German,
keyboard and mobile checks remain pending. Read `AUDIT-STATUS.md` for release state.

Credentials are in `.audit-db/local-staging/test-accounts.passwords.txt`; do not
share that file. The snapshot is `e5b7d46` plus the current retry/translation and
TypeScript-exclusion changes copied explicitly. It does not follow later edits.

## Continue setup

1. Confirm Docker is healthy. Start only the dedicated configuration:

   ```powershell
   supabase start --workdir .audit-db/local-staging --exclude 'logflare,vector,edge-runtime,imgproxy,studio,postgres-meta,realtime,mailpit'
   ```

   This command may display local keys: do not paste its output into a review or
   chat. Initial image downloads/extraction can take time on a low-memory machine.

2. For a future rebuild, obtain and validate a schema-only production baseline without business rows.
   Do not run historical production seed/password migrations. The saved failed
   export was not usable; it has now been replaced by the successful export. Import a successful baseline into
   the dedicated local database, then apply the pending offline migration there.

3. The isolated snapshot's `.env.local` is now generated from the local stack's status.
   The required keys are `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Do not copy the
   workspace's production `.env.local`. Synthetic users for two branches have been
   created. Seed and verification scripts remain ignored local setup material;
   verification creates only synthetic attendance/review/roster records.

4. Once configured, from the repository root:

   ```powershell
   node scripts/ops/start-local-staging.mjs --check
   node scripts/ops/start-local-staging.mjs
   ```

   The launcher refuses remote URLs, other ports and URL path overrides. It runs
   the isolated app snapshot with AI, Sentry and push credentials disabled. Use
   the dedicated browser hostname above to avoid sharing cookies with another
   project on `localhost`. A source snapshot must be refreshed deliberately after
   implementation changes; it does not automatically follow the working tree.

Schema export required the IPv4 session pooler because the container could not
reach the production IPv6 address. CLI-generated shell output also required LF
line endings and separate quoted schema flags. Temporary dump credentials remain
in ignored local files; never include them in a review bundle.

The root TypeScript check excludes `.audit-db` so a nested source snapshot is not
part of the actual application's typecheck. Local setup and generated credentials
stay ignored. Never use `--linked` on a write/reset command for these local tests.
Do not stop, reset or reconfigure unrelated local Supabase stacks.
