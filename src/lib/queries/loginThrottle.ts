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
//
// Since 2026-10-24 (docs/security/ATTACK-REVIEW-2026-10-24.md, A1/A2) the whole sign-in
// runs here, on the server: signIn() is the only export. The old
// browser flow (check → sign in from the browser → recordFail) could be skipped by
// posting to Supabase Auth directly, and recordFail(email) let anyone lock any account.
// A lock now also bans the auth user for the window, so Supabase Auth itself refuses
// the password even when someone bypasses this app.
// ============================================================================

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Per-account limit: tight, because a real person knows their own password.
// 3 wrong tries for your own address, then a 15-minute cooldown (auto-unlocks —
// see WINDOW_MS). No manager needed; raise this before the window if 3 is too
// tight for shared tablets. A manager can still unlock early if that flow is
// added (see note in checkLogin).
const MAX_EMAIL = 3;

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
async function checkLogin(email: string): Promise<{ blocked: boolean; retryAfter?: number; locked?: boolean }> {
  const id = norm(email);
  const ipKey = await clientIpKey();
  try {
    // Hard lock takes priority: once MAX_EMAIL is hit the account is flagged
    // login_locked and only a manager can clear it (see recordFail + the
    // /api/unlock-login route). No retryAfter — waiting does nothing.
    if (id) {
      const { data: u } = await admin().from("users").select("login_locked").eq("email", id).maybeSingle();
      if (u?.login_locked) {
        // Stay locked only while failed attempts are still arriving. recordFail()
        // is a public endpoint, so without this anyone could permanently lock any
        // account just by posting its email a few times. If the window has passed
        // with no new fails, auto-clear (a manager can still unlock instantly via
        // /api/unlock-login). A genuine ongoing attack keeps the counter warm and
        // stays locked.
        const { n } = await countSince(id);
        if (n > 0) return { blocked: true, locked: true };
        await admin().from("users").update({ login_locked: false }).eq("email", id);
      }
    }

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
async function recordFail(email: string): Promise<void> {
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

    // Hard-lock the account once it reaches MAX_EMAIL failures in the window.
    // A manager can clear it instantly (/api/unlock-login); otherwise checkLogin
    // auto-clears it once the failure window passes with no new attempts, so a
    // malicious lockout via this public endpoint can't strand anyone for long.
    if (id) {
      const { n } = await countSince(id);
      if (n >= MAX_EMAIL) {
        const { data: u } = await a.from("users").update({ login_locked: true }).eq("email", id).select("id").maybeSingle();
        // Enforced by Supabase Auth too, so a direct API sign-in is refused for the window.
        if (u?.id) await a.auth.admin.updateUserById(u.id, { ban_duration: `${Math.ceil(WINDOW_MS / 60000)}m` });
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "loginThrottle", op: "recordFail" } });
  }
}

// ── Call AFTER a successful sign-in ─────────────────────────────────────────
// Takes no email argument on purpose: the address is read from the session the
// caller just established, so this cannot be used to clear someone else's
// counter. If the caller is not actually signed in, it does nothing.
async function finishLogin(): Promise<{ ok: boolean }> {
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

type SignInResult = { ok: true } | { ok: false; code: "locked" | "throttled" | "invalid" | "bad"; retryAfter?: number };

// The one public entry point for password sign-in. Runs the throttle, the sign-in and
// the bookkeeping on the server, so none of the steps can be skipped from a browser.
export async function signIn(email: unknown, password: unknown): Promise<SignInResult> {
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password
    || email.length > 254 || password.length > 200) return { ok: false, code: "bad" };
  const gate = await checkLogin(email);
  if (gate.blocked) return { ok: false, code: gate.locked ? "locked" : "throttled", retryAfter: gate.retryAfter };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: norm(email), password });
  if (error || !data.user) {
    await recordFail(email);
    return { ok: false, code: "invalid" }; // never echo Supabase's message (no account probing)
  }
  await finishLogin();
  return { ok: true };
}
