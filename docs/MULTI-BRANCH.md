# Multi-branch picker — agreed design (2026-10-23)

Owner decisions: picker for owners **and** managers linked to 2+ branches; brand owner's
HQ/Branch toggle becomes the same picker; an "All my branches" read-only overview; brand
owner assigns branches in the app. Built as its own release after `feature/hardening-round`.

## Already in place (database)
- `user_branches(user_id, branch_id)` links a person to extra branches.
- `accessible_branch_ids()` returns home branch + linked branches for manager/branch_owner,
  all branches for brand_owner/super_admin. RLS already scopes data to it.

## To build (app)
1. **One shared `getActiveBranch()`** (server): reads an `active_branch` cookie, accepts it only
   if it is in `accessible_branch_ids()`, otherwise falls back to the home branch. Replaces
   the 26 local `getMe()` copies that read `users.branch_id`.
2. **Header picker** next to EN | DE, only when the person has 2+ branches. Options:
   "All my branches" (read-only overview) + each branch. Brand owner: replaces HQ/Branch toggle.
3. **Wrong-branch guard:** branch name always visible in the header; write screens (stock count,
   delivery, roster, payroll approval, transfers) show it in their title. "All my branches" has
   no write actions.
4. **Assignment UI:** People & Team → person → Branches (brand owner only), writing `user_branches`.
5. **Checks:** a test that a forged cookie for a foreign branch falls back to the home branch;
   e2e: owner switches branch, counts stock, the count lands in that branch only.

## Not in v1
Staff working in two branches (clock-in at either branch).
