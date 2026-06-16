"use server";

import { createClient } from "@/lib/supabase/server";

// Lists documents across the manager's branch that are expiring within 60 days
// (or already expired), newest-expiry first, with the owner's name. Manager-only.

const DOC_LABEL: Record<string, string> = {
  id_card: "ID Card / Passport", visa: "Visa / Residence Permit", work_permit: "Work Permit",
  contract: "Contract", certificate: "Certificate", other: "Document",
};

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

export async function getBranchExpiringDocs() {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in.", items: [], count: 0 };
  if (!isManager(role)) return { ok: false, error: "Managers only.", items: [], count: 0 };

  const horizon = new Date(); horizon.setDate(horizon.getDate() + 60);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const { data: docs } = await supabase
    .from("user_documents")
    .select("id, user_id, doc_type, expiry_date")
    .eq("branch_id", branchId)
    .not("expiry_date", "is", null)
    .lte("expiry_date", horizonStr)
    .order("expiry_date", { ascending: true });

  const { data: staff } = await supabase.from("users").select("id, full_name").eq("branch_id", branchId);
  const nameOf: Record<string, string> = {};
  for (const s of staff || []) nameOf[s.id] = s.full_name;

  const items = (docs || []).map((d) => {
    const days = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / 86400000);
    return {
      id: d.id, userId: d.user_id,
      name: nameOf[d.user_id] || "Unknown",
      docLabel: DOC_LABEL[d.doc_type] || "Document",
      expiry: d.expiry_date, days,
    };
  });

  return { ok: true, items, count: items.length };
}