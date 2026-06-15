"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// DOCUMENT WORKFLOW — data layer (Phase 2)
// Versioned uploads, manager approve/reject, required-doc checklist,
// expiring-docs dashboard, and access-checked signed URLs.
// Status model on each user_documents row: pending | approved | rejected | archived
// Effective (display) status overlays expiry on approved docs: expiring / expired.
// ============================================================

const MANAGER_ROLES = ["manager", "branch_owner", "brand_owner", "super_admin"];
const EXPIRING_DAYS = 60; // an approved doc within this many days reads "expiring soon"

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}
const isManager = (r?: string | null) => MANAGER_ROLES.includes(r || "");

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

// Effective status for display/filtering: expiry overlays an approved doc.
function effectiveStatus(status: string, expiry?: string | null):
  "pending" | "approved" | "rejected" | "archived" | "expiring" | "expired" {
  if (status === "approved" && expiry) {
    const d = daysUntil(expiry);
    if (d !== null && d < 0) return "expired";
    if (d !== null && d <= EXPIRING_DAYS) return "expiring";
  }
  return status as any;
}

// ── UPLOAD A NEW VERSION ────────────────────────────────────────────────────
// The file is already in the 'documents' bucket. A new upload is a NEW row
// (pending, not active) — it never overwrites history, and only becomes the
// active document once a manager approves it.
export async function uploadDocumentVersion(
  docType: string, filePath: string, fileName: string, issueDate?: string, expiryDate?: string
) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const { count } = await supabase
    .from("user_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("doc_type", docType);

  const { error } = await supabase.from("user_documents").insert({
    user_id: user.id,
    branch_id: branchId ?? null,
    doc_type: docType,
    file_path: filePath,
    file_name: fileName,
    issue_date: issueDate || null,
    expiry_date: expiryDate || null,
    status: "pending",
    is_active: false,
    uploaded_by: user.id,
    version_no: (count || 0) + 1,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── LIST (staff: own) ───────────────────────────────────────────────────────
export async function listMyDocuments() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", docs: [] };

  const { data, error } = await supabase
    .from("user_documents")
    .select("id, doc_type, file_path, file_name, issue_date, expiry_date, status, is_active, version_no, rejection_reason, reviewed_at, created_at")
    .eq("user_id", user.id)
    .order("doc_type", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, docs: [] };

  const docs = (data || []).map((d) => ({
    ...d, eff: effectiveStatus(d.status, d.expiry_date), days: daysUntil(d.expiry_date),
  }));
  return { ok: true, docs };
}

// ── LIST (manager: one employee) ────────────────────────────────────────────
export async function listEmployeeDocuments(userId: string) {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", docs: [] };
  if (!isManager(role)) return { ok: false, error: "Managers only.", docs: [] };

  // RLS (userdocs_manager_read) already scopes this to the manager's branch.
  const { data, error } = await supabase
    .from("user_documents")
    .select("id, user_id, doc_type, file_path, file_name, issue_date, expiry_date, status, is_active, version_no, rejection_reason, reviewed_at, created_at")
    .eq("user_id", userId)
    .order("doc_type", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, docs: [] };

  const docs = (data || []).map((d) => ({
    ...d, eff: effectiveStatus(d.status, d.expiry_date), days: daysUntil(d.expiry_date),
  }));
  return { ok: true, docs };
}

// ── APPROVE (manager) ───────────────────────────────────────────────────────
export async function approveDocument(docId: string) {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const { data: doc, error: e0 } = await supabase
    .from("user_documents").select("id, user_id, doc_type").eq("id", docId).single();
  if (e0 || !doc) return { ok: false, error: "Document not found." };

  // Demote any other versions of the same type for this employee.
  await supabase.from("user_documents")
    .update({ is_active: false })
    .eq("user_id", doc.user_id).eq("doc_type", doc.doc_type).neq("id", docId);

  const { error } = await supabase.from("user_documents")
    .update({ status: "approved", is_active: true, reviewed_by: user.id, reviewed_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", docId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── REJECT (manager) ────────────────────────────────────────────────────────
export async function rejectDocument(docId: string, reason: string) {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  if (!reason || !reason.trim()) return { ok: false, error: "A rejection reason is required." };

  const { error } = await supabase.from("user_documents")
    .update({ status: "rejected", is_active: false, reviewed_by: user.id, reviewed_at: new Date().toISOString(), rejection_reason: reason.trim() })
    .eq("id", docId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── ARCHIVE instead of hard-delete ──────────────────────────────────────────
export async function archiveDocument(docId: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  // RLS lets staff update their own rows and managers their branch's rows.
  const { error } = await supabase.from("user_documents")
    .update({ status: "archived", is_active: false }).eq("id", docId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── ACCESS-CHECKED SIGNED URL ───────────────────────────────────────────────
// Only signs a URL if the caller can actually see the document row (RLS scopes
// the lookup to own docs / managed branch), closing the open-signing gap.
export async function getDocumentUrl(filePath: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const { data: doc } = await supabase
    .from("user_documents").select("id").eq("file_path", filePath).maybeSingle();
  if (!doc) return { ok: false, error: "Not found or no access." };

  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: data.signedUrl };
}

// ── REQUIRED-DOC CHECKLIST (for one employee) ───────────────────────────────
export async function getRequiredChecklist(userId: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", items: [] };

  const { data: target } = await supabase.from("users").select("branch_id").eq("id", userId).single();
  const branchId = target?.branch_id ?? null;

  // Branch-specific rule overrides the global rule for the same doc_type.
  const { data: rules } = await supabase
    .from("required_documents").select("doc_type, is_required, sort_order, branch_id");
  const byType: Record<string, any> = {};
  for (const r of rules || []) {
    if (r.branch_id === null && byType[r.doc_type]) continue;          // keep branch-specific
    if (r.branch_id !== null && r.branch_id !== branchId) continue;    // other branches' rules
    if (r.branch_id !== null || !byType[r.doc_type]) byType[r.doc_type] = r;
  }
  const ruleList = Object.values(byType).sort((a: any, b: any) => a.sort_order - b.sort_order);

  const { data: docs } = await supabase
    .from("user_documents")
    .select("id, doc_type, status, expiry_date, is_active, rejection_reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const items = ruleList.map((r: any) => {
    const ofType = (docs || []).filter((d) => d.doc_type === r.doc_type);
    const active = ofType.find((d) => d.is_active && d.status === "approved");
    const pending = ofType.find((d) => d.status === "pending");
    const latest = ofType[0];

    let status: string, expiry: string | null = null, days: number | null = null, docId: string | null = null, reason: string | null = null;
    if (active) {
      status = effectiveStatus("approved", active.expiry_date);
      expiry = active.expiry_date; days = daysUntil(active.expiry_date); docId = active.id;
    } else if (pending) {
      status = "pending"; expiry = pending.expiry_date; docId = pending.id;
    } else if (latest && latest.status === "rejected") {
      status = "rejected"; docId = latest.id; reason = latest.rejection_reason;
    } else {
      status = "missing";
    }
    return { docType: r.doc_type, isRequired: r.is_required, status, expiry, days, docId, reason };
  });

  return { ok: true, items };
}

// ── EXPIRING-DOCS DASHBOARD (manager) ───────────────────────────────────────
// Returns every branch document the manager can see (with owner name + effective
// status + days), the list of MISSING required docs across staff, and bucket
// counts. The page applies the branch/employee/type/status/period filters.
export async function getDocumentsDashboard() {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const { data: staff } = await supabase.from("users").select("id, full_name, branch_id");
  const nameOf: Record<string, string> = {};
  for (const s of staff || []) nameOf[s.id] = s.full_name;

  const { data: rawDocs } = await supabase
    .from("user_documents")
    .select("id, user_id, branch_id, doc_type, expiry_date, status, is_active, file_path, reviewed_at")
    .order("expiry_date", { ascending: true });

  const docs = (rawDocs || []).map((d) => ({
    ...d, name: nameOf[d.user_id] || "Unknown",
    eff: effectiveStatus(d.status, d.expiry_date), days: daysUntil(d.expiry_date),
  }));

  // Required-doc rules → which staff are MISSING which required doc.
  const { data: rules } = await supabase.from("required_documents").select("doc_type, is_required, branch_id");
  const requiredTypes = (rules || []).filter((r) => r.is_required).map((r) => r.doc_type);
  const haveActive = new Set(
    docs.filter((d) => d.is_active && d.status === "approved").map((d) => `${d.user_id}|${d.doc_type}`)
  );
  const missing: { userId: string; name: string; docType: string; branch_id: string | null }[] = [];
  for (const s of staff || []) {
    for (const dt of requiredTypes) {
      if (!haveActive.has(`${s.id}|${dt}`)) {
        missing.push({ userId: s.id, name: s.full_name, docType: dt, branch_id: s.branch_id });
      }
    }
  }

  const approvedWithExpiry = docs.filter((d) => d.status === "approved" && d.is_active && d.days !== null);
  const counts = {
    within30: approvedWithExpiry.filter((d) => d.days! >= 0 && d.days! <= 30).length,
    within60: approvedWithExpiry.filter((d) => d.days! > 30 && d.days! <= 60).length,
    within90: approvedWithExpiry.filter((d) => d.days! > 60 && d.days! <= 90).length,
    expired: approvedWithExpiry.filter((d) => d.days! < 0).length,
    pending: docs.filter((d) => d.status === "pending").length,
    missing: missing.length,
  };

  return {
    ok: true,
    docs,
    missing,
    counts,
    staff: (staff || []).map((s) => ({ id: s.id, name: s.full_name })),
  };
}