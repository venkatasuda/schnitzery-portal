import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { canActOnUser, isManagerRole } from "@/lib/auth/rank";

// ============================================================
// SECURE SERVER ROUTE — deactivate ("remove") or reactivate a
// staff member. Removing sets status=inactive AND bans their
// auth login, so a former employee can no longer sign in or
// clock in. NOTHING is deleted — the users row and all history
// (attendance, audit, etc.) stay in the database for records.
// Reactivating reverses both (status=active + lifts the ban).
// Uses the SERVICE-ROLE key (server only) for the auth change.
// ============================================================

const BAN_FOREVER = "876000h"; // ~100 years

export async function POST(request: Request) {
  // 1. Verify the CALLER (their session cookie — not the admin key).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });

  const { data: me } = await supabase
    .from("users").select("role, branch_id").eq("id", user.id).single();
  if (!me || !isManagerRole(me.role)) {
    return NextResponse.json({ ok: false, error: "Managers only." }, { status: 403 });
  }

  // 2. Parse input.
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const { userId, active } = body as { userId?: string; active?: boolean };
  if (!userId || typeof active !== "boolean") {
    return NextResponse.json({ ok: false, error: "Missing userId or active flag." }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ ok: false, error: "You can't remove your own account." }, { status: 400 });
  }

  // 3. Admin client (service-role key — server only).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ ok: false, error: "Server not configured (missing service key)." }, { status: 500 });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 4. Load the target + authorize (own branch unless owner; never act on someone above your rank).
  const { data: target } = await admin
    .from("users").select("role, branch_id").eq("id", userId).single();
  if (!target) return NextResponse.json({ ok: false, error: "Staff member not found." }, { status: 404 });

  // Branch confinement + rank rule live in src/lib/auth/rank.ts so they can be
  // unit-tested. Equal rank is refused on purpose — see rank.test.ts.
  const gate = canActOnUser({
    meRole: me.role,
    meBranchId: me.branch_id,
    targetRole: target.role,
    targetBranchId: target.branch_id,
  });
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  // 5 & 6. Two writes that must agree: the users.status row and the auth ban.
  // They cannot be made atomic across the two systems, so order them by which
  // failure is safer to be left in:
  //   DEACTIVATING → ban first. If the status write then fails, they are locked
  //     out but still shown as active. Annoying, safe.
  //   REACTIVATING → status first. If the unban then fails, they are shown as
  //     active but can't log in yet. Annoying, safe.
  // The dangerous ordering is the reverse: "shown as inactive but can still log
  // in and clock in", which is what the previous version could leave behind.
  const setStatus = () => admin
    .from("users").update({ status: active ? "active" : "inactive" }).eq("id", userId);
  const setBan = () => admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });

  if (active) {
    const { error: statusErr } = await setStatus();
    if (statusErr) return NextResponse.json({ ok: false, error: statusErr.message }, { status: 400 });

    const { error: banErr } = await setBan();
    if (banErr) {
      return NextResponse.json({
        ok: false,
        error: "Marked active, but re-enabling the login failed — they can't sign in yet: " + banErr.message,
      }, { status: 400 });
    }
  } else {
    const { error: banErr } = await setBan();
    if (banErr) {
      return NextResponse.json({ ok: false, error: "Could not disable the login: " + banErr.message }, { status: 400 });
    }

    const { error: statusErr } = await setStatus();
    if (statusErr) {
      return NextResponse.json({
        ok: false,
        error: "Login disabled, but the status update failed — they still show as active: " + statusErr.message,
      }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}