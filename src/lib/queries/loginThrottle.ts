"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";

// After MAX failed attempts within WINDOW, the account is temporarily blocked.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX = 6;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
const norm = (email: string) => (email || "").trim().toLowerCase();

// call BEFORE attempting sign-in
export async function checkLogin(email: string): Promise<{ blocked: boolean; retryAfter?: number; remaining?: number }> {
  const id = norm(email);
  if (!id) return { blocked: false, remaining: MAX };
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data } = await admin()
      .from("auth_throttle").select("attempted_at")
      .eq("identifier", id).gte("attempted_at", since).order("attempted_at", { ascending: true });
    const rows = data || [];
    if (rows.length >= MAX) {
      const oldest = new Date(rows[0].attempted_at).getTime();
      const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 1000));
      return { blocked: true, retryAfter };
    }
    return { blocked: false, remaining: MAX - rows.length };
  } catch {
    // never let the throttle store block a real login if it errors
    return { blocked: false };
  }
}

// call AFTER a failed sign-in
export async function recordFail(email: string): Promise<void> {
  const id = norm(email);
  if (!id) return;
  try {
    const a = admin();
    await a.from("auth_throttle").insert({ identifier: id });
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    await a.from("auth_throttle").delete().eq("identifier", id).lt("attempted_at", cutoff);
  } catch { /* best effort */ }
}

// call AFTER a successful sign-in
export async function clearAttempts(email: string): Promise<void> {
  const id = norm(email);
  if (!id) return;
  try { await admin().from("auth_throttle").delete().eq("identifier", id); } catch { /* best effort */ }
}