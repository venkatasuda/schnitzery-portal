"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================================
// GLOBAL SEARCH — one box to find employees and branches. Results are
// automatically scoped by RLS (a manager only sees their branch; an owner sees
// all). Each employee links to their full record (attendance, timesheets,
// documents, shifts all live on the staff detail page).
// ============================================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

export async function globalSearch(q: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in.", employees: [], branches: [] };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!MGR.includes(me?.role ?? "")) return { ok: false as const, error: "Managers only.", employees: [], branches: [] };

  const clean = (q || "").replace(/[%,()]/g, "").trim();
  if (clean.length < 2) return { ok: true as const, employees: [], branches: [] };
  const like = `%${clean}%`;

  const [empR, brR, allBr] = await Promise.all([
    supabase.from("users").select("id, full_name, employee_code, role, team, branch_id")
      .or(`full_name.ilike.${like},employee_code.ilike.${like},email.ilike.${like}`)
      .neq("role", "kiosk").limit(10),
    supabase.from("branches").select("id, name").ilike("name", like).limit(6),
    supabase.from("branches").select("id, name"),
  ]);

  const brName: Record<string, string> = {};
  (allBr.data || []).forEach((b) => { brName[b.id] = b.name; });

  const employees = (empR.data || []).map((u) => ({
    id: u.id,
    name: u.full_name || "—",
    code: u.employee_code || "",
    sub: [u.team, u.branch_id ? brName[u.branch_id] : null].filter(Boolean).join(" · "),
    role: u.role,
  }));
  const branches = (brR.data || []).map((b) => ({ id: b.id, name: b.name }));

  return { ok: true as const, employees, branches };
}