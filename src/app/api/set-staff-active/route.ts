import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ============================================================
// SECURE SERVER ROUTE — deactivate ("remove") or reactivate a
// staff member. Removing sets status=inactive AND bans their
// auth login, so a former employee can no longer sign in or
// clock in. NOTHING is deleted — the users row and all history
// (attendance, audit, etc.) stay in the database for records.
// Reactivating reverses both (status=active + lifts the ban).
// Uses the SERVICE-ROLE key (server only) for the auth change.
// ============================================================

const RANK: Record<string, number> = {
  super_admin: 5, brand_owner: 4, branch_owner: 3, manager: 2, staff: 1, kiosk: 0,
};
const BAN_FOREVER = "876000h"; // ~100 years

export async function POST(request: Request) {
  // 1. Verify the CALLER (their session cookie — not the admin key).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });

  const { data: me } = await supabase
    .from("users").select("role, branch_id").eq("id", user.id).single();
  if (!me || !["manager", "branch_owner", "brand_owner", "super_admin"].includes(me.role)) {
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

  const isOwner = ["brand_owner", "super_admin"].includes(me.role);
  if (!isOwner && target.branch_id !== me.branch_id) {
    return NextResponse.json({ ok: false, error: "You can only manage staff in your own branch." }, { status: 403 });
  }
  if ((RANK[target.role] ?? 0) > (RANK[me.role] ?? 0)) {
    return NextResponse.json({ ok: false, error: "You can't remove someone above your role." }, { status: 403 });
  }

  // 5. Update status (admin client → no JWT, so it bypasses RLS and the sensitive-column trigger cleanly).
  const { error: statusErr } = await admin
    .from("users").update({ status: active ? "active" : "inactive" }).eq("id", userId);
  if (statusErr) return NextResponse.json({ ok: false, error: statusErr.message }, { status: 400 });

  // 6. Ban / un-ban the auth login.
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (banErr) {
    return NextResponse.json({
      ok: false,
      error: "Status was updated, but the login change failed: " + banErr.message,
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}