# Branching & release flow

Feature → **develop** (test everything) → **main** (live production). Lightweight
GitHub Flow + a staging branch — right-sized for a small team on Vercel.

## Branches
| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | **Production** — always live, always releasable. Protected. | Vercel **Production** (schnitzery-portal.vercel.app) |
| `develop` | **Integration / testing** — features land here first and are tested together. Protected. | Vercel **staging** preview URL |
| `feature/*` | one short-lived branch per feature or fix | ephemeral Vercel preview per PR |
| `hotfix/*` | urgent production fix, branched off `main` | preview → straight to `main`, then back-merge to `develop` |

There is **no separate "deployment" branch** — deploying *is* merging into `main`
(prod) or `develop` (staging). Vercel does the deploy automatically.

## The everyday flow
```bash
# start a feature off develop
git switch develop && git pull
git switch -c feature/waste-report

# …work, commit…
git push -u origin feature/waste-report
# open a PR:  feature/waste-report  →  develop
```
1. The PR runs **CI** (type-check, tests, build) + **secret scan** + **CodeQL**, and
   Vercel posts a **preview URL**. Review + test on that URL.
2. Merge to `develop`. That deploys the **staging** site — do final testing there.
3. When a batch on `develop` is good, open a PR **`develop → main`**. CI runs again.
4. Merge to `main` → **production deploys**. Tag the release: `git tag v1.1.0 && git push --tags`.

### Hotfix
```bash
git switch main && git pull
git switch -c hotfix/login-crash
# fix, PR → main, merge, prod deploys
git switch develop && git merge main   # keep develop in sync
```

## Branch protection (do this once, in GitHub → Settings → Branches)
Protect **both** `main` and `develop`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → **`CI gate`** and **`gitleaks`**
- ✅ Require branches to be up to date before merging
- (main) ✅ Do not allow bypassing / no direct pushes

Without this, the branches exist but broken code can still be merged. This rule is
what makes "test on develop before it reaches production" actually enforced.

## One-time setup
```bash
git switch main && git pull
git switch -c develop
git push -u origin develop
```
Then set `develop` as the **default branch for new PRs** if you like, protect both
branches as above, and in Vercel confirm `main` = Production (develop gets a preview).

## Rules of thumb
- Never commit directly to `main` (or `develop`) — always via PR.
- One feature = one `feature/*` branch = one PR. Keep them small.
- `main` is always deployable. If it's red, fixing it is priority #1.
- Majors/dependency upgrades: their own PR, tested on `develop` first.
