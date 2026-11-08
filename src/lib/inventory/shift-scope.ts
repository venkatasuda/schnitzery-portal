import "server-only";
// Who may use the daily inventory tasks: managers (any operational role) or active staff marked as
// shift leader for their branch. The database enforces the exact rights per task (migration 20261108150000);
// this only decides whether a server action talks to the database at all.
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor, MULTI_BRANCH_ROLES } from "@/lib/activeBranch";

export async function shiftScope() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: me } = await db.from("users").select("role,branch_id,status").eq("id", user.id).single();
  if (!me || me.status !== "active") return null;
  const manager = MULTI_BRANCH_ROLES.includes(me.role);
  const branch = await activeBranchFor(db, me);
  if (!branch) return null;
  if (!manager) {
    const { data: lead } = await db.rpc("can_plan_prep", { p_branch: branch });
    if (lead !== true) return null;
  }
  return { db, branch, user, manager };
}
