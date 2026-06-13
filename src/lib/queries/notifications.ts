"use server";

import { createClient } from "@/lib/supabase/server";

// Personal notifications for the signed-in user (RLS is user-scoped).
export async function getMyNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, items: [], unread: 0 };

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: error.message, items: [], unread: 0 };

  const items = data || [];
  return { ok: true, items, unread: items.filter((n) => !n.is_read).length };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}