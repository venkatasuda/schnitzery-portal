# Monorepo migration runbook (Stage 1)

Turns the single Next.js app into a Turborepo monorepo so `apps/api`, `apps/agents`,
containers and GCP become possible — **without** rewriting the app.

> ⚠ Do this in a **branch**, run `npm run build` (or `pnpm build`) **after every step**,
> and only merge when green. Do NOT do it the day of a demo. It touches every config
> and import root; a careless move breaks the app. Budget ~half a day.

## Target layout
```
schnitzery/
├─ apps/
│  ├─ web/          # today's app: src/, public/, next.config.ts, tsconfig.json, sentry.*, capacitor.config.ts, android/
│  ├─ api/          # (later) Fastify/NestJS service → imports @schnitzery/core
│  └─ agents/       # (later) AI agents/workers → imports @schnitzery/core
├─ packages/
│  ├─ core/         # pure domain logic + types, NO next/* imports   → @schnitzery/core
│  ├─ db/           # supabase/postgres client + migrations + types  → @schnitzery/db
│  └─ ui/           # (optional) shared React components              → @schnitzery/ui
├─ infra/           # docker/ (done), terraform/, k8s/
├─ package.json     # workspaces root (private, no app deps)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ .github/workflows/
```

## Prereqs / decisions
- **Package manager:** switch npm → **pnpm** (best workspace support). `npm i -g pnpm`.
  Delete `package-lock.json`, add `pnpm-workspace.yaml`, run `pnpm install`.
- Keep the existing app fully working inside `apps/web` before extracting any packages.

## Step 1 — move the app into apps/web (no logic changes)
1. `git switch -c chore/monorepo`
2. Create `apps/web/`. Move into it: `src/`, `public/`, `android/`, `next.config.ts`,
   `tsconfig.json`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
   `capacitor.config.ts`, `sentry.*.config.ts`, `package.json`.
   (Use `git mv` so history follows.)
3. Root now has NO app. Create a root `package.json`:
   ```json
   { "name": "schnitzery", "private": true, "packageManager": "pnpm@9",
     "scripts": { "dev": "turbo dev", "build": "turbo build", "lint": "turbo lint" } }
   ```
4. `pnpm-workspace.yaml`:
   ```yaml
   packages: ["apps/*", "packages/*"]
   ```
5. `turbo.json`:
   ```json
   { "$schema": "https://turbo.build/schema.json",
     "tasks": { "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
                "dev": { "cache": false, "persistent": true }, "lint": {} } }
   ```
6. `cd apps/web && pnpm install && pnpm build`. **Must be green before continuing.**
7. **Vercel:** set the project's **Root Directory = `apps/web`** (Settings → General).
   CI workflows: update paths to `apps/web`.
8. Move `scripts/`, `docs/`, `supabase/` stay at the repo ROOT (they're cross-app), and
   fix any script paths that assumed the app was at root.

## Step 2 — extract @schnitzery/db
1. `packages/db/` with its own `package.json` (`"name": "@schnitzery/db"`).
2. Move `apps/web/supabase/*` (migrations, types) and a **framework-agnostic** client
   factory here: a `createDbClient(url, key, { getToken })` that does NOT import
   `next/headers`. The Next cookie wiring stays in `apps/web` and calls this factory.
3. `pnpm add @schnitzery/db --filter web`; update imports. Build green.

## Step 3 — extract @schnitzery/core (the payoff)
1. `packages/core/` — pure TS domain logic + types, **zero `next/*` imports**.
2. Move the business rules out of `apps/web/src/lib/queries/*`: each function takes a
   `db` client (from `@schnitzery/db`) as a parameter instead of importing the Next
   server client. The web layer becomes a thin adapter: get the request-scoped db in
   the server action, call `core.decideLeave(db, …)`.
   - Start with the pure ones (rank rules, berlin-date, payroll math — already close).
   - This is the ONE refactor that makes api/agents reuse real; do it incrementally.
3. Build green after each moved domain.

## Step 4 — (later, only when needed) apps/api and apps/agents
- `apps/api`: Fastify or NestJS, imports `@schnitzery/core` + `@schnitzery/db`,
  Dockerfile in `infra/docker/Dockerfile.api`, deploy to Cloud Run.
- `apps/agents`: worker/agent service, same imports, its own Dockerfile.
- Neither reimplements logic — they call `@schnitzery/core`.

## Rollback
Every step is a commit on the branch. If a step fails to build, `git reset --hard`
the step and retry. Nothing is merged to main until `turbo build` is fully green and
a manual smoke test of login + one manager flow passes.

## What NOT to change
- Don't split `src/app` into "frontend/backend" — Next colocates them by design.
- Don't adopt Kubernetes yet — Cloud Run first (see infra/README.md).
- Don't move `supabase/` migrations out of version-ordered form.
