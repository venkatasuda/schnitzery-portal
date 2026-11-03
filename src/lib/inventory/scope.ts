import "server-only";
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor,MULTI_BRANCH_ROLES } from "@/lib/activeBranch";
export async function inventoryScope(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return null;
 const {data:me}=await db.from("users").select("role,branch_id,status").eq("id",user.id).single();
 if(!me||me.status!=="active"||!MULTI_BRANCH_ROLES.includes(me.role))return null;
 const branch=await activeBranchFor(db,me);return branch?{db,branch}:null;
}
