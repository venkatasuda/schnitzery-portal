// The signed-in user for server actions: one shared lookup instead of a private copy in every query file.
// cache(): several actions on the same server request reuse one auth + profile read.
// branchId = the branch the user is working in (active branch for multi-branch roles), homeBranchId = their own.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";

export const getMe = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, role: null, name: null, branchId: null, homeBranchId: null };
  const { data: profile } = await supabase.from("users").select("id, full_name, role, branch_id, status, contract_hours").eq("id", user.id).single();
  return {
    supabase, user, profile,
    role: profile?.role ?? null, name: profile?.full_name ?? null,
    branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null,
  };
});
