# Multi-branch picker (Release I)

Owner decisions (2026-10-23): picker for owners **and** managers linked to 2+ branches; the
brand owner's HQ/Branch toggle became the same picker; an "All my branches" read-only
overview; the brand owner assigns branches in the app.

## What it does
- **Header picker** next to EN | DE (`BranchPicker`). Shown to brand owners always
  ("All branches (HQ)" + each branch) and to managers/branch owners with 2+ branches
  ("All my branches" + each branch). Staff and single-branch managers see nothing new.
- **Whole portal follows the choice**: every manager query reads its branch from one shared
  resolver, `src/lib/activeBranch.ts` → `activeBranchFor()`. The `sch_branch` cookie is only
  a request: it is used only if the branch is in `accessible_branch_ids()`, otherwise the home
  branch. A forged cookie can never reach another owner's branch (also enforced by RLS).
- **Personal actions stay on the home branch**: own leave, availability, corrections, cover
  requests, own documents and clock-in (`homeBranchId` in the query helpers).
- **All my branches** (`/my-branches`): today per branch — working, scheduled, late,
  no-shows, hours, items to approve — read-only, with "Open" to switch into a branch.
- **Assigning branches**: People & Team → person → *Branches* (brand owners only). Managers
  and branch owners can be linked; staff stay single-branch in this version.

## Database (migration `20261023120000_multi_branch_access.sql`)
The database already had `user_branches` and `accessible_branch_ids()`, but 19 older policies
and 3 functions still compared against the HOME branch only (waste, deliveries, temperature
logs/units, stock batches, transfers, cover requests, payroll approval, wage entry,
"pending" notifications). The migration aligns them with `accessible_branch_ids()`.
- Staff: unchanged (their accessible set is exactly the home branch).
- Brand owners: these tables now follow their existing "all branches" access, like the rest.
- Proven by `scripts/checks/multi-branch-access.cjs` (linked manager in/out, other manager
  out, staff out, wage + payroll rules) and `e2e/multi-branch.e2e.ts` (switch + write lands in
  the chosen branch; forged cookie falls back to home).

## Deploy
1. Merge the PR (Vercel deploys). Until the migration is applied, single-branch use is
   unchanged; a linked branch's waste/deliveries/temperature/transfers would be refused.
2. Apply the migration in Supabase `vxwtmtlkwvwcdegtcjuz` (SQL editor or `supabase db push`).
3. Link an owner to a second branch (People & Team → person → Branches) and check the picker.

Rollback: re-create the 19 policies from `supabase/schema/production-schema.sql` and the two
functions from `20261013144029_wage_effective_history.sql`; the app falls back to home-branch
behaviour automatically when nobody is linked.

## Known limits (v1)
- The kiosk clock QR (`current_clock_code`) uses the account's home branch. A kiosk account
  belongs to one branch, so this is correct for kiosks; a manager showing the QR from their own
  login shows their home branch's code.
- Staff working in two branches is not supported yet.
