"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// ANNOUNCEMENTS — manager posts, everyone reads.
// announcements: id, branch_id, title, message, category, author,
//   pinned, created_at
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(role || "");
}

// ── Everyone: read announcements (pinned first, then newest) ──
export async function getAnnouncements() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", announcements: [], canPost: false };
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("branch_id", branchId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, announcements: [], canPost: false };
  return { ok: true, announcements: data || [], canPost: isManager(profile?.role) };
}

// ── Manager: post an announcement ──
export async function postAnnouncement(title: string, message: string, category: string, pinned: boolean) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!message.trim()) return { ok: false, error: "Message can't be empty." };
  const { error } = await supabase.from("announcements").insert({
    branch_id: branchId,
    title: title || null,
    message,
    category: category || null,
    author: profile?.full_name || "Manager",
    pinned: !!pinned,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Manager: toggle pin ──
export async function togglePin(id: string, pinned: boolean) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("announcements").update({ pinned }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Manager: delete an announcement ──
export async function deleteAnnouncement(id: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}