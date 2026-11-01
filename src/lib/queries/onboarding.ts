"use server";

import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/readAll";
import { activeBranchFor } from "@/lib/activeBranch";
import { mondayOfDate } from "@/lib/time/berlinDate";
import { wageMapForBranches } from "@/lib/pay/wages";
import { onboardingSteps, NEW_HIRE_DAYS, type OnboardingStep } from "@/lib/people/onboarding";

// New hires (joined in the last 90 days) of the active branch with their onboarding steps.
// Read-only; every step comes from existing data (src/lib/people/onboarding.ts).
const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

export async function getBranchOnboarding() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in.", people: [] };
  const { data: p } = await db.from("users").select("role, branch_id").eq("id", user.id).single();
  if (!MGR.includes(p?.role ?? "")) return { ok: false as const, error: "Managers only.", people: [] };
  const branchId = await activeBranchFor(db, p);
  if (!branchId) return { ok: false as const, error: "No branch.", people: [] };

  const since = new Date(Date.now() - NEW_HIRE_DAYS * 864e5).toISOString();
  const { data: hires, error } = await readAll(db.from("users")
    .select("id, full_name, created_at, contract_type, contract_hours, employee_code, must_change_password")
    .eq("branch_id", branchId).eq("status", "active").neq("role", "kiosk").gte("created_at", since).order("id"));
  if (error) return { ok: false as const, error: error.message, people: [] };
  if (!hires?.length) return { ok: true as const, people: [] };
  const ids = hires.map((h) => h.id);
  const firstWeek = mondayOfDate(String(hires.reduce((a, h) => (String(h.created_at) < a ? String(h.created_at) : a), String(hires[0].created_at))).slice(0, 10));

  const [wages, docs, avail, rosters, worked] = await Promise.all([
    wageMapForBranches(db, [branchId]).catch(() => ({} as Record<string, number | null>)),
    readAll(db.from("user_documents").select("user_id, doc_type").in("user_id", ids).eq("status", "approved").eq("is_active", true).order("id")),
    readAll(db.from("availability").select("user_id").in("user_id", ids).order("user_id")),
    readAll(db.from("weekly_roster").select("roster_data").eq("branch_id", branchId).gte("week_start", firstWeek).order("week_start")),
    readAll(db.from("attendance_logs").select("user_id").in("user_id", ids).eq("status", "complete").order("id")),
  ]);
  const err = docs.error || avail.error || rosters.error || worked.error;
  if (err) return { ok: false as const, error: err.message, people: [] };

  const docsOf = new Map<string, Set<string>>();
  for (const d of docs.data || []) (docsOf.get(d.user_id) ?? docsOf.set(d.user_id, new Set()).get(d.user_id)!).add(d.doc_type);
  const hasAvail = new Set((avail.data || []).map((a) => a.user_id));
  const shift = new Set((worked.data || []).map((w) => w.user_id));
  for (const r of rosters.data || []) for (const day of Object.values((r.roster_data || {}) as Record<string, { user_id?: string }[]>)) for (const e of day || []) if (e?.user_id) shift.add(e.user_id);

  const people = hires.map((h) => {
    const steps: OnboardingStep[] = onboardingSteps({
      contractType: h.contract_type, contractHours: h.contract_hours == null ? null : Number(h.contract_hours), code: h.employee_code,
      wage: wages[h.id] ?? null, approvedDocs: docsOf.get(h.id) ?? new Set(), availability: hasAvail.has(h.id), firstShift: shift.has(h.id), loggedIn: !h.must_change_password,
    });
    return { id: h.id, name: h.full_name || "—", joined: String(h.created_at).slice(0, 10), steps, open: steps.filter((s) => !s.done).length };
  });
  return { ok: true as const, people };
}
