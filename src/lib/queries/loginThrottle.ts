"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";

// ============================================================================
// LOGIN THROTTLE
//
// Two independent counters, both stored in `auth_throttle` (identifier, attempted_at):
//   • per-email  — identifier is the bare lowercased email (unchanged format,
//                  so existing rows keep working; no migration needed)
//   • per-IP     — identifier is "ip:<address>"
//
// SECURITY NOTE — why there is no exported clearAttempts():
// Every export of a "use server" module is a publicly callable POST endpoint
// with a stable action ID. It does not matter whether a component imports it.
// A previously exported clearAttempts(email) therefore let anyone reset any
// account's failure counter, making the throttle a no-op: guess, fail, clear,
// repeat. Clearing is now only reachable through finishLogin(), which first
// verifies the caller actually holds a valid session for that address.
// Keep it that way — do not export the raw clear.
// ============================================================================

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Per-account limit: tight, because a real person knows their own password.
const MAX_EMAIL = 6;

// Per-IP limit: deliberately generous. An entire branch shares one NAT'd office
// IP — 30 staff on shared tablets at shift change legitimately produce a burst of
// sign-ins, and locking that out would take the store offline. This is sized to
// stop credential spraying (which needs hundreds of attempts across many
// accounts), NOT to be a second per-user limit. Raise it before lowering it.
const MAX_IP = 40;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const norm = (email: string) => (email || "").trim().toLowerCase();

// Client IP, trusting the proxy header Vercel sets. Falls back to a constant so
// a missing header degrades to "one shared bucket" rather than throwing.
async function clientIpKey(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") || "";
    const ip = fwd.split(",")[0].trim() || h.get("x-real-ip") || "";
    return ip ? `ip:${ip}` : "ip:unknown";
  } catch {
    return "ip:unknown";
  }
}

async function countSince(identifier: string): Promise<{ n: number; oldest: number | null }> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data } = await admin()
    .from("auth_throttle").select("attempted_at")
    .eq("identifier", identifier).gte("attempted_at", since)
    .order("attempted_at", { ascending: true });
  const rows = data || [];
  return { n: rows.length, oldest: rows.length ? new Date(rows[0].attempted_at).getTime() : null };
}

function retryAfterFrom(oldest: number | null): number {
  if (oldest == null) return Math.ceil(WINDOW_MS / 1000);
  return Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 1000));
}

// ── Call BEFORE attempting sign-in ──────────────────────────────────────────
// Returns only { blocked, retryAfter }. It deliberately does NOT report how many
// attempts remain — that told an attacker exactly how much room they had left.
export async function checkLogin(email: string): Promise<{ blocked: boolean; retryAfter?: number }> {
  const id = norm(email);
  const ipKey = await clientIpKey();
  try {
    const [byEmail, byIp] = await Promise.all([
      id ? countSince(id) : Promise.resolve({ n: 0, oldest: null }),
      countSince(ipKey),
    ]);

    if (byEmail.n >= MAX_EMAIL) return { blocked: true, retryAfter: retryAfterFrom(byEmail.oldest) };
    if (byIp.n >= MAX_IP) return { blocked: true, retryAfter: retryAfterFrom(byIp.oldest) };
    return { blocked: false };
  } catch (err) {
    // Fail OPEN so a throttle-store outage can never lock staff out of their own
    // shift. That is the right availability call, but it silently removes all
    // brute-force protection — so make sure it is never silent.
    Sentry.captureException(err, { tags: { area: "loginThrottle", effect: "failed-open" } });
    return { blocked: false };
  }
}

// ── Call AFTER a failed sign-in ─────────────────────────────────────────────
export async function recordFail(email: string): Promise<void> {
  const id = norm(email);
  const ipKey = await clientIpKey();
  try {
    const a = admin();
    const rows = [{ identifier: ipKey }, ...(id ? [{ identifier: id }] : [])];
    await a.from("auth_throttle").insert(rows);

    // Opportunistic cleanup of this key's expired rows.
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    await a.from("auth_throttle").delete()
      .in("identifier", rows.map((r) => r.identifier)).lt("attempted_at", cutoff);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "loginThrottle", op: "recordFail" } });
  }
}

// ── Call AFTER a successful sign-in ─────────────────────────────────────────
// Takes no email argument on purpose: the address is read from the session the
// caller just established, so this cannot be used to clear someone else's
// counter. If the caller is not actually signed in, it does nothing.
export async function finishLogin(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false }; // not signed in → refuse to clear

    const a = admin();
    const ipKey = await clientIpKey();
    await a.from("auth_throttle").delete().in("identifier", [norm(user.email), ipKey]);
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "loginThrottle", op: "finishLogin" } });
    return { ok: false };
  }
}
