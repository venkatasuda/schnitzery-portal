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

// Every role the system understands. An unrecognised string written into
// users.role produces an account that fails every isManager() check and shows
// no role label — broken in a way that is hard to spot. Keep in sync with the
// CHECK constraint on users.role.
const VALID_ROLES = ["staff", "manager", "branch_owner", "brand_owner", "super_admin", "kiosk"];
const ELEVATED_ROLES = ["manager", "branch_owner", "brand_owner", "super_admin"];
const OWNER_ROLES = ["branch_owner", "brand_owner", "super_admin"];
const MIN_PASSWORD = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Rejects the handful of passwords people actually pick when told "10 characters".
const WEAK_PASSWORDS = [
  "password12", "1234567890", "qwertyuiop", "schnitzery", "schnitzery1",
  "welcome123", "letmein123", "changeme12",
];

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

  // 2. Parse and validate the form data
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const { password, full_name, team, role, employee_code, contract_type, contract_hours, phone } = body;

  // Normalise the address the same way loginThrottle does, so the throttle
  // records actually match the account they are meant to protect.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !password) return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "That doesn't look like a valid email address." }, { status: 400 });
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }
  if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
    return NextResponse.json({ ok: false, error: "That password is too easy to guess — pick another." }, { status: 400 });
  }

  const newRole = role || "staff";
  if (!VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ ok: false, error: "Unknown role." }, { status: 400 });
  }
  // Only owners may create other managers/owners
  if (ELEVATED_ROLES.includes(newRole) && !OWNER_ROLES.includes(me.role)) {
    return NextResponse.json({ ok: false, error: "Only owners can create managers." }, { status: 403 });
  }

  // 3. Admin client (service-role key — server only)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ ok: false, error: "Server not configured (missing service key)." }, { status: 500 });
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 3b. Auto-generate an employee code when the manager left it blank.
  // Format: <BRANCH CODE>-<next number in that branch>, e.g. STG-001. This is a
  // DEFAULT only — a manager can type their own code, and edit it later. The
  // prefix comes from branches.code (editable), so the scheme stays flexible.
  // ponytail: next-number is max+1; a rare double-add could collide — fine for a
  // single branch, add a unique index + retry if it ever bites.
  let code = typeof employee_code === "string" ? employee_code.trim() : "";
  if (!code) {
    const { data: br } = await admin.from("branches").select("code, name").eq("id", me.branch_id).single();
    const prefix = ((br?.code || (br?.name || "EMP").replace(/[^A-Za-z]/g, "").slice(0, 3)) || "EMP").toUpperCase();
    const { data: existing } = await admin
      .from("users").select("employee_code").eq("branch_id", me.branch_id).ilike("employee_code", `${prefix}-%`);
    let max = 0;
    for (const r of existing || []) {
      const m = /-(\d+)\s*$/.exec(r.employee_code || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    code = `${prefix}-${String(max + 1).padStart(3, "0")}`;
  }

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
    employee_code: code || null,
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