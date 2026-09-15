import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { canActOnUser, isManagerRole } from "@/lib/auth/rank";

// ============================================================
// SECURE SERVER ROUTE — clear a login lock.
// A login is hard-locked after too many failed attempts (see
// loginThrottle.ts). Only a manager may lift it, and only for
// staff in their own branch and below their rank. Same caller-
// verification + rank pattern as set-staff-active.
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

  // 3. Admin client (service-role key — server only).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ ok: false, error: "Server not configured (missing service key)." }, { status: 500 });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 4. Load target + authorize (own branch, never above your rank).
  const { data: target } = await admin
    .from("users").select("role, branch_id, email").eq("id", userId).single();
  if (!target) return NextResponse.json({ ok: false, error: "Staff member not found." }, { status: 404 });

  const gate = canActOnUser({
    meRole: me.role, meBranchId: me.branch_id,
    targetRole: target.role, targetBranchId: target.branch_id,
  });
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  // 5. Clear the lock flag AND the throttle counters, so they get a fresh set of
  //    attempts rather than being re-locked by leftover rows in the window.
  const { error: upErr } = await admin.from("users").update({ login_locked: false }).eq("id", userId);
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
  if (target.email) {
    await admin.from("auth_throttle").delete().eq("identifier", String(target.email).trim().toLowerCase());
  }

  return NextResponse.json({ ok: true });
}
