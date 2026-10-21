"use server";
import { createClient } from "@/lib/supabase/server";

export async function getOfflineIssues(manager=false, reviewed=false) {
  if(typeof manager!=="boolean" || typeof reviewed!=="boolean")return {ok:false,error:"Invalid view."};
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return {ok:false,error:"Not logged in."};
  const {data:me,error:profileError}=await db.from("users").select("role,branch_id").eq("id",user.id).single();
  if(profileError || !me?.branch_id || (manager && !["manager","branch_owner","brand_owner","super_admin"].includes(me.role)))return {ok:false,error:"Access denied."};
  let query=db.from("offline_attendance_issues").select("id,full_name,action,captured_at,error,note,reviewed_at")
    .eq(manager?"branch_id":"user_id",manager?me.branch_id:user.id);
  if(manager)query=reviewed?query.not("reviewed_at","is",null):query.is("reviewed_at",null);
  const {data,error}=await query.order("created_at",{ascending:!reviewed}).order("id").limit(100);
  return error?{ok:false,error:"Review records could not be loaded."}:{ok:true,rows:data||[]};
}

export async function reviewOfflineIssue(id:string,note:string) {
  if(typeof id!=="string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || typeof note!=="string" || !note.trim() || note.length>2000)return {ok:false,error:"Provide a review note."};
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return {ok:false,error:"Not logged in."};
  const {data:event,error:eventError}=await db.from("attendance_events").select("branch_id").eq("id",id).not("error","is",null).single();
  if(eventError || !event)return {ok:false,error:"Record unavailable."};
  // RLS checks manager role, branch access, error evidence and the actor.
  const {error}=await db.from("attendance_event_reviews").insert({event_id:id,branch_id:event.branch_id,reviewed_by:user.id,note:note.trim()});
  return error?{ok:false,error:error.code==="23505"?"Already reviewed. Reload the list.":"Review could not be saved."}:{ok:true};
}
