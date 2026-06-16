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
  if (!user) return { ok: false as const, error: "Not logged in.", employees: [], branches: [], documents: [] };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!MGR.includes(me?.role ?? "")) return { ok: false as const, error: "Managers only.", employees: [], branches: [], documents: [] };

  const clean = (q || "").replace(/[%,()]/g, "").trim();
  if (clean.length < 2) return { ok: true as const, employees: [], branches: [], documents: [] };
  const like = `%${clean}%`;

  const [empR, brR, allBr, docR] = await Promise.all([
    supabase.from("users").select("id, full_name, employee_code, role, team, branch_id")
      .or(`full_name.ilike.${like},employee_code.ilike.${like},email.ilike.${like}`)
      .neq("role", "kiosk").limit(10),
    supabase.from("branches").select("id, name").ilike("name", like).limit(6),
    supabase.from("branches").select("id, name"),
    supabase.from("user_documents").select("id, user_id, doc_type, file_name, status, expiry_date")
      .or(`doc_type.ilike.${like},file_name.ilike.${like}`)
      .eq("is_active", true).limit(8),
  ]);

  const brName: Record<string, string> = {};
  (allBr.data || []).forEach((b) => { brName[b.id] = b.name; });

  // resolve owner names for the matched documents (one extra query, RLS-scoped)
  const ownerIds = [...new Set((docR.data || []).map((d) => d.user_id).filter(Boolean))];
  const docOwner: Record<string, string> = {};
  if (ownerIds.length) {
    const { data: owners } = await supabase.from("users").select("id, full_name").in("id", ownerIds);
    (owners || []).forEach((o) => { docOwner[o.id] = o.full_name || "—"; });
  }

  const employees = (empR.data || []).map((u) => ({
    id: u.id,
    name: u.full_name || "—",
    code: u.employee_code || "",
    sub: [u.team, u.branch_id ? brName[u.branch_id] : null].filter(Boolean).join(" · "),
    role: u.role,
  }));
  const branches = (brR.data || []).map((b) => ({ id: b.id, name: b.name }));
  const documents = (docR.data || []).map((d) => ({
    id: d.id,
    userId: d.user_id,
    docType: d.doc_type || "—",
    owner: d.user_id ? (docOwner[d.user_id] || "—") : "—",
    expiry: d.expiry_date || null,
    status: d.status || null,
  }));

  return { ok: true as const, employees, branches, documents };
}