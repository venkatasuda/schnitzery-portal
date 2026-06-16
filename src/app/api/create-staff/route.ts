import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ============================================================
// SECURE SERVER ROUTE — creates a staff login + users row.
// Uses the SERVICE-ROLE key, which has admin powers and MUST
// only ever run on the server (here). Never expose it client-side.
// Flow: verify caller is a manager → create auth user → create
// users row → return result.
// ============================================================

export async function POST(request: Request) {
  // 1. Verify the CALLER is logged in and is a manager (uses the
  //    normal RLS client + their session cookie — NOT the admin key).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("users").select("role, branch_id").eq("id", user.id).single();

  if (!me || !["manager", "branch_owner", "brand_owner", "super_admin"].includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Managers only." }, { status: 403 });
  }

  // 2. Parse the form data
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const { email, password, full_name, team, role, employee_code, contract_type, contract_hours, phone } = body;

  if (!email || !password) return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
  // Only owners may create other managers/owners
  const newRole = role || "staff";
  if (["manager", "branch_owner", "brand_owner", "super_admin"].includes(newRole) && !["branch_owner", "brand_owner", "super_admin"].includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Only owners can create managers." }, { status: 403 });
  }

  // 3. Admin client (service-role key — server only)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ ok: false, error: "Server not configured (missing service key)." }, { status: 500 });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 4. Create the auth user (email confirmed so they can log in immediately)
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (authErr) {
    return NextResponse.json({ ok: false, error: authErr.message }, { status: 400 });
  }
  const newId = created.user?.id;
  if (!newId) return NextResponse.json({ ok: false, error: "Could not create user." }, { status: 500 });

  // 5. Create / update their users row (a DB trigger may already insert a base
  //    row on signup, so upsert to be safe). Assign to the manager's branch.
  const { error: rowErr } = await admin.from("users").upsert({
    id: newId,
    email,
    full_name: full_name || null,
    team: team || null,
    role: newRole,
    employee_code: employee_code || null,
    contract_type: contract_type || null,
    contract_hours: contract_hours == null || contract_hours === "" || Number.isNaN(Number(contract_hours)) ? null : Number(contract_hours),
    phone: phone || null,
    branch_id: me.branch_id,
    status: "active",
  });
  if (rowErr) {
    // best-effort cleanup so we don't leave an orphan auth user
    await admin.auth.admin.deleteUser(newId).catch((e) => console.error("create-staff: orphan auth-user cleanup failed for", newId, e));
    return NextResponse.json({ ok: false, error: rowErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: newId });
}