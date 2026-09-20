import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { canActOnUser, isManagerRole } from "@/lib/auth/rank";

// ============================================================
// SECURE SERVER ROUTE — reset a staff member's password.
// The workforce has no real email inboxes (logins are credential-only
// addresses), so self-service email recovery is impossible. Recovery is
// therefore manager-driven: a manager generates a one-time temporary
// password here, hands it to the person, and they are forced to set their
// own on next login (must_change_password = true).
// Same caller-verification + rank/branch rules as set-staff-active.
// ============================================================

export async function POST(request: Request) {
  // 1. Verify the CALLER via their session cookie — not the admin key.
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
  const { userId } = body as { userId?: string };
  if (!userId) return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  if (userId === user.id) {
    return NextResponse.json({ ok: false, error: "Change your own password in Profile instead." }, { status: 400 });
  }

  // 3. Admin client (service-role key — server only).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ ok: false, error: "Server not configured (missing service key)." }, { status: 500 });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 4. Load target + authorize (own branch, never above your rank).
  const { data: target } = await admin
    .from("users").select("role, branch_id, full_name").eq("id", userId).single();
  if (!target) return NextResponse.json({ ok: false, error: "Staff member not found." }, { status: 404 });

  const gate = canActOnUser({
    meRole: me.role, meBranchId: me.branch_id,
    targetRole: target.role, targetBranchId: target.branch_id,
  });
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  // 5. Generate a readable one-time temp password and set it.
  const temp = "Sz-" + randomBytes(5).toString("base64url"); // ~10 chars, e.g. Sz-Xa9kQ2
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: temp });
  if (pwErr) return NextResponse.json({ ok: false, error: pwErr.message }, { status: 400 });

  // 6. Force them to set their own on next login, and lift any lockout.
  const { error: flagErr } = await admin.from("users")
    .update({ must_change_password: true, login_locked: false }).eq("id", userId);
  if (flagErr) {
    return NextResponse.json({
      ok: false,
      error: "Password reset, but flags didn't update: " + flagErr.message, tempPassword: temp,
    }, { status: 400 });
  }

  // Return the temp password ONCE for the manager to hand over. Not stored anywhere.
  return NextResponse.json({ ok: true, tempPassword: temp, name: target.full_name });
}
