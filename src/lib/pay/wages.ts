import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// WAGE LOOKUPS — audit item 18
//
// Wages live in `user_pay`, NOT on `users`. This is not a tidiness preference:
// Postgres RLS is row-level, so any policy that lets a staff member read a
// colleague's `users` row hands over EVERY column of it, wages included. The
// only way to restrict a single column is to move it to a table with its own
// policy. `user_pay` is manager-only for reads and writes; a user may read
// their own row and nobody but a manager may write one.
//
// NOTE: this file has NO "use server" directive on purpose. Every export of a
// "use server" module becomes a publicly callable endpoint — see item 1 in
// PRODUCTION-AUDIT.md for what that cost us. These are plain helpers, imported
// by server modules only, and must stay that way.
// ============================================================================

export type WageMap = Record<string, number | null>;

function toMap(rows: { user_id: string; hourly_wage: number | string | null }[] | null): WageMap {
  const map: WageMap = {};
  for (const r of rows || []) {
    map[r.user_id] = r.hourly_wage == null ? null : Number(r.hourly_wage);
  }
  return map;
}

// Wages for everyone in the given branches. RLS silently drops any branch the
// caller cannot manage, so a non-manager gets back an empty map rather than an
// error — callers should already have checked isManager() before getting here.
export async function wageMapForBranches(
  supabase: SupabaseClient,
  branchIds: (string | null | undefined)[],
): Promise<WageMap> {
  const ids = branchIds.filter((b): b is string => !!b);
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("user_pay")
    .select("user_id, hourly_wage")
    .in("branch_id", ids);

  return toMap(data);
}

// Wages for a specific set of users.
export async function wageMapForUsers(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[],
): Promise<WageMap> {
  const ids = userIds.filter((u): u is string => !!u);
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("user_pay")
    .select("user_id, hourly_wage")
    .in("user_id", ids);

  return toMap(data);
}

// Set one person's wage. The caller MUST have already verified they are a
// manager for this user's branch — RLS enforces it again server-side, but the
// app should not be relying on a policy error for its access control.
export async function setWage(
  supabase: SupabaseClient,
  userId: string,
  branchId: string | null,
  wage: number | null,
  actor: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("user_pay").upsert({
    user_id: userId,
    branch_id: branchId,
    hourly_wage: wage,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
