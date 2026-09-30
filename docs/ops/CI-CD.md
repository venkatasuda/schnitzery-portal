# CI / CD

## CI — GitHub Actions (`.github/workflows/`)
Runs on every push and PR to `main`, jobs in parallel for fast feedback.

| Workflow | Job | Gates? | Purpose |
|---|---|---|---|
| `ci.yml` | type-check (`tsc`) | **blocks** | real breakage |
| `ci.yml` | unit tests + coverage (vitest) | **blocks** | logic correctness (payroll, berlin-date, rank rules) |
| `ci.yml` | production build (`next build`) | **blocks** | app compiles for prod |
| `ci.yml` | lint (eslint) | advisory | style backlog (flip to blocking once cleared) |
| `ci.yml` | dependency audit (`npm audit`) | advisory | known CVEs in deps |
| `ci.yml` | **ci-gate** | **required status** | single green check for branch protection |
| `secret-scan.yml` | gitleaks | **blocks PR** | stop a committed key/password (private-repo safe) |
| `codeql.yml` | CodeQL SAST | reports | injection/auth/data-flow bugs (see caveat) |
| `dependabot.yml` | — | — | weekly dep + action update PRs |

### Make it mean something — branch protection (repo setting, not a file)
GitHub → Settings → Branches → add a rule for `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → select **`CI gate`** (and `gitleaks`)
- ✅ Require branches up to date before merging
Without this, CI runs but a red build can still be merged. This is the step that turns "we have CI" into "broken code can't reach main."

### Caveats (be honest about the platform)
- **CodeQL** and GitHub **dependency-review** are free on **public** repos; on a **private** repo they need **GitHub Advanced Security** (paid). If this repo is private without GHAS, CodeQL won't start — that's expected. `gitleaks` and `npm audit` work regardless, so secret + CVE coverage is intact either way.
- If gitleaks flags the **historical** leak (already rotated/purged, see `docs/incidents/`), add a `.gitleaks.toml` allowlist to baseline it.

## CD — today: Vercel
Deployment is Vercel's Git integration, not a workflow file:
- Push to `main` → Vercel builds and deploys **production**.
- Every PR → Vercel posts a **preview URL**.
This is the correct CD for a Next app on Vercel; a hand-written deploy workflow would just duplicate it. Gate prod quality via the branch protection above (CI must be green to merge to `main`).

## CD — later: GCP Cloud Run
When you move off Vercel (see `docs/architecture/MONOREPO-MIGRATION.md` + `infra/`),
add `.github/workflows/deploy-cloudrun.yml`:
1. On push to `main` (after CI green): build the image from `infra/docker/Dockerfile.web`.
2. Push to Artifact Registry (auth via Workload Identity Federation — no long-lived keys).
3. `gcloud run deploy` to a **staging** service → smoke test → manual approval (GitHub Environment) → **production**.
Not added yet on purpose: it would be dead YAML while you're on Vercel.

## Required secrets (set in GitHub → Settings → Secrets → Actions)
- Today: none — CI builds with placeholder env; Vercel holds the real env.
- For GCP CD later: `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`.
