import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// ACTIVE BRANCH — which branch a manager-type user is working in right now.
//
// Managers, branch owners and brand owners can be linked to several branches
// (user_branches; brand owners see all). The header picker stores the choice in
// the sch_branch cookie. The cookie is only a REQUEST: it is accepted only when the
// branch is in accessible_branch_ids() for this user, otherwise the home branch
// is used. RLS enforces the same set in the database, so a forged cookie can at
// most fall back to the home branch — never reach another owner's data.
//
// Staff always work in their home branch. Personal actions (own leave, own
// availability, own corrections/cover, own documents, clock-in) use homeBranchId.
// ============================================================================

export const BRANCH_COOKIE = "sch_branch";
export const MULTI_BRANCH_ROLES = ["manager", "branch_owner", "brand_owner", "super_admin"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated DB types are not wired into every caller
type Db = SupabaseClient<any, any, any>;

// Branches this user may work in. Cached per request and client.
export const accessibleBranchIds = cache(async (db: Db): Promise<string[]> => {
  const { data, error } = await db.rpc("accessible_branch_ids");
  if (error || !Array.isArray(data)) return [];
  return data.map((r: unknown) => (typeof r === "string" ? r : (r as { accessible_branch_ids?: string })?.accessible_branch_ids)).filter((x): x is string => !!x);
});

export async function activeBranchFor(db: Db, profile: { role?: string | null; branch_id?: string | null } | null | undefined): Promise<string | null> {
  const home = profile?.branch_id ?? null;
  if (!MULTI_BRANCH_ROLES.includes(profile?.role ?? "")) return home;
  let wanted: string | undefined;
  try { wanted = (await cookies()).get(BRANCH_COOKIE)?.value; } catch { return home; }
  if (!wanted || wanted === home || !/^[0-9a-f-]{36}$/i.test(wanted)) return home;
  return (await accessibleBranchIds(db)).includes(wanted) ? wanted : home;
}

// Picker data for the header: every branch the user may work in, by name.
export async function branchChoices(db: Db): Promise<{ id: string; name: string }[]> {
  const ids = await accessibleBranchIds(db);
  if (ids.length === 0) return [];
  const { data } = await db.from("branches").select("id, name").in("id", ids).order("name");
  return (data as { id: string; name: string }[] | null) || [];
}
