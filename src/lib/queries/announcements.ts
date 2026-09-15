"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/actions";

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
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
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

  // Push to every active branch member except the author. Uses the manager's own
  // wording so it's naturally in their language; best-effort, never blocks the post.
  try {
    const { data: members } = await supabase
      .from("users").select("id")
      .eq("branch_id", branchId).eq("status", "active").neq("id", user.id);
    const body = message.length > 120 ? message.slice(0, 117) + "…" : message;
    await Promise.all(
      (members || []).slice(0, 100).map((m) =>
        sendPushToUser(m.id, { title: `📣 ${title || "Schnitzery"}`, body, url: "/announcements" })
          .catch(() => { /* best effort per recipient */ }),
      ),
    );
  } catch { /* push is optional — a posting must still succeed without it */ }

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