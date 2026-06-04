"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// ATTENDANCE QUERIES — the data layer for clock in/out.
// These run on the server. RLS ensures users only touch their
// own branch's rows. The logged-in user is detected automatically.
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

// Today's date as YYYY-MM-DD (server timezone).
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

  return {
    ok: true,
    clockedIn,
    onBreak,
    session: latest,
  };
}

// Clock in — creates a new active session for today.
export async function clockIn() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "Your account has no branch assigned." };

  // Guard: don't double clock-in if already active today.
  const status = await getMyStatus();
  if (status.ok && status.clockedIn) {
    return { ok: false, error: "You are already clocked in." };
  }

  const now = new Date();
  const { error } = await supabase.from("attendance_logs").insert({
    user_id: user.id,
    branch_id: branchId,
    work_date: todayStr(),
    clock_in: now.toISOString(),
    status: "active",
    approval_status: "pending",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Clock out — closes the active session, computes duration.
export async function clockOut() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const status = await getMyStatus();
  if (!status.ok || !status.clockedIn || !status.session) {
    return { ok: false, error: "You are not clocked in." };
  }

  const session = status.session;
  if (session.status === "on-break") {
    return { ok: false, error: "End your break before clocking out." };
  }
  const now = new Date();
  const start = new Date(session.clock_in);
  // Total elapsed time (break time is NOT subtracted — timer counts everything).
  const durationMin = Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
  const breakMin = totalBreakMins(parseBreaks(session.breaks));

  const { error } = await supabase
    .from("attendance_logs")
    .update({
      clock_out: now.toISOString(),
      duration_mins: durationMin,
      status: "complete",
    })
    .eq("id", session.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, durationMin, breakMin };
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
// Breaks are stored as JSON in the `breaks` column: an array of
// { start: ISO, end: ISO|null }. The last entry with end=null is an open break.

function parseBreaks(raw: any): Array<{ start: string; end: string | null }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function totalBreakMins(breaks: Array<{ start: string; end: string | null }>): number {
  let total = 0;
  for (const b of breaks) {
    if (b.start && b.end) {
      total += Math.max(0, Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000));
    }
  }
  return total;
}

// Start a break on the current active session.
export async function startBreak() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const status = await getMyStatus();
  if (!status.ok || !status.session) return { ok: false, error: "You are not clocked in." };
  const session = status.session;
  if (session.status !== "active") return { ok: false, error: "You are not clocked in." };

  const breaks = parseBreaks(session.breaks);
  const openBreak = breaks.find((b) => b.end === null);
  if (openBreak) return { ok: false, error: "You are already on a break." };

  breaks.push({ start: new Date().toISOString(), end: null });

  const { error } = await supabase
    .from("attendance_logs")
    .update({ breaks: JSON.stringify(breaks), status: "on-break" })
    .eq("id", session.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// End the current open break.
export async function endBreak() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const status = await getMyStatus();
  if (!status.ok || !status.session) return { ok: false, error: "No active session." };
  const session = status.session;

  const breaks = parseBreaks(session.breaks);
  const openBreak = breaks.find((b) => b.end === null);
  if (!openBreak) return { ok: false, error: "You are not on a break." };

  openBreak.end = new Date().toISOString();

  const { error } = await supabase
    .from("attendance_logs")
    .update({ breaks: JSON.stringify(breaks), status: "active" })
    .eq("id", session.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, totalBreakMins: totalBreakMins(breaks) };
}