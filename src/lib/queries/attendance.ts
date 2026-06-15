"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// ATTENDANCE QUERIES — the data layer for clock in/out.
// Writes (clock in/out, breaks) go through SECURITY DEFINER
// database functions so timestamps are stamped server-side and
// staff cannot fabricate hours by writing the table directly.
// Reads stay as normal RLS-scoped selects.
// ============================================================

// Helper: get the current user + their branch_id from their profile.
async function getMe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null };

  const { data: profile } = await supabase
    .from("users")
    .select("branch_id")
    .eq("id", user.id)
    .single();

  return { supabase, user, branchId: profile?.branch_id ?? null };
}

// Today's date as YYYY-MM-DD (UTC — matches the DB functions).
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// What's my current status today? Returns the latest open/closed session.
export async function getMyStatus() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("work_date", todayStr())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { ok: false, error: error.message };

  const latest = data && data.length ? data[0] : null;
  const clockedIn = !!latest && (latest.status === "active" || latest.status === "on-break");
  const onBreak = !!latest && latest.status === "on-break";

  return { ok: true, clockedIn, onBreak, session: latest };
}

// Clock in — server-stamped via the clock_in() database function.
// `code` is the in-store rotating code; the DB validates it when the branch
// requires it (and ignores it otherwise).
export async function clockIn(code?: string, lat?: number | null, lng?: number | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in", { p_code: code ?? null, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Clock out — server-stamped + duration computed in clock_out().
export async function clockOut(code?: string, lat?: number | null, lng?: number | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clock_out", { p_code: code ?? null, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true, durationMin: data?.durationMin ?? 0, breakMin: data?.breakMin ?? 0 };
}

// Get my attendance history, optionally filtered by a date range.
// from/to are "YYYY-MM-DD" strings (inclusive). Both optional.
export async function getMyHistory(from?: string, to?: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", sessions: [] };

  let query = supabase
    .from("attendance_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) query = query.gte("work_date", from);
  if (to) query = query.lte("work_date", to);

  const { data, error } = await query.limit(200);
  if (error) return { ok: false, error: error.message, sessions: [] };

  return { ok: true, sessions: data || [] };
}

// ── BREAKS ──────────────────────────────────────────────────────────────
// Breaks live in the jsonb `breaks` column as an array of
// { start: ISO, end: ISO|null }. Both writes are server-stamped in the DB.

// Start a break on the current active session.
export async function startBreak() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_break");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// End the current open break.
export async function endBreak() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_break");
  if (error) return { ok: false, error: error.message };
  return { ok: true, totalBreakMins: data?.totalBreakMins ?? 0 };
}