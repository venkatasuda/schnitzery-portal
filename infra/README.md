# Infrastructure

How Schnitzery deploys today and how it can move to GCP later — without a rewrite.

## Today
- **Web:** Next.js on **Vercel** (from the main branch).
- **Database / Auth / Storage:** **Supabase** (managed Postgres).
- Nothing here is required while on Vercel; it's the on-ramp for containers/GCP.

## Containerize (when leaving Vercel or adding services)
The app builds a standalone server (`output: "standalone"` in `next.config.ts`).

```bash
docker build -f infra/docker/Dockerfile.web -t schnitzery-web .
docker run -p 3000:3000 --env-file .env.local schnitzery-web
```

## Deploy on GCP — use Cloud Run before Kubernetes
**Cloud Run** runs the container serverless with almost no ops. Reach for GKE/K8s
only once you run several always-on services and have someone to operate them.

```bash
# one-time: create an Artifact Registry repo, then:
gcloud builds submit --tag europe-west3-docker.pkg.dev/PROJECT/schnitzery/web
gcloud run deploy schnitzery-web \
  --image europe-west3-docker.pkg.dev/PROJECT/schnitzery/web \
  --region europe-west3 --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=...,..." \
  --set-secrets  "SUPABASE_SERVICE_ROLE_KEY=svc-role:latest,VAPID_PRIVATE_KEY=vapid:latest"
```

- Put secrets in **Secret Manager**, not env files (`--set-secrets`).
- `NEXT_PUBLIC_*` are build-time — pass them as build args in CI, not at run.

## Database portability
Supabase **is** Postgres, so there is no lock-in. To move off it later:
1. Provision **Cloud SQL for Postgres**.
2. Replay `supabase/migrations/*` onto it.
3. Change the connection string / client config in `packages/db` (post-migration) or `src/lib/supabase` (today).
Auth is the one piece to plan for — Supabase Auth would be replaced by e.g. GCP Identity Platform; keep auth calls behind a thin wrapper so that swap is localized.

## Folders
- `docker/` — Dockerfiles per app.
- `terraform/` — (future) GCP infra as code: Cloud Run service, Cloud SQL, Secret Manager, Artifact Registry.
- `k8s/` — (only if you outgrow Cloud Run) manifests / Helm chart.

See `docs/architecture/MONOREPO-MIGRATION.md` for the repo restructure that makes
`apps/api` and `apps/agents` possible.
