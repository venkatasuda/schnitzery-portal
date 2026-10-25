"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor, MULTI_BRANCH_ROLES } from "@/lib/activeBranch";
import { readAll } from "@/lib/supabase/readAll";

export type CountSession = { id: string; branch_id: string; count_date: string; status: "draft" | "completed" | "cancelled"; revision: number; created_at: string; completed_at: string | null };
export type CountLine = { id: string; product: string; category: string; unit: string | null; target: number; quantity: number | null };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

async function scope() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("users").select("role,branch_id,status").eq("id", user.id).single();
  if (profile?.status !== "active" || !MULTI_BRANCH_ROLES.includes(profile?.role ?? "")) return null;
  const branch = await activeBranchFor(db, profile);
  return branch ? { db, branch } : null;
}

export async function getCountSessions(selected?: string) {
  const ctx = await scope();
  if (!ctx) return { ok: false as const, error: "access" };
  if (selected && !uuid(selected)) return { ok: false as const, error: "invalid" };
  const [branch, recent, open] = await Promise.all([
    ctx.db.from("branches").select("id,name").eq("id", ctx.branch).single(),
    ctx.db.from("inventory_count_sessions").select("*").eq("branch_id", ctx.branch).order("created_at", { ascending: false }).limit(20),
    ctx.db.from("inventory_count_sessions").select("*").eq("branch_id", ctx.branch).eq("status", "draft").maybeSingle(),
  ]);
  if (branch.error || recent.error || open.error) return { ok: false as const, error: "load" };
  let session = (open.data ?? recent.data?.[0] ?? null) as CountSession | null;
  if (selected) {
    const result = await ctx.db.from("inventory_count_sessions").select("*").eq("id", selected).eq("branch_id", ctx.branch).single();
    if (result.error) return { ok: false as const, error: "load" };
    session = result.data as CountSession;
  }
  const lines = session ? await readAll(ctx.db.from("inventory_count_lines").select("id,product,category,unit,target,quantity").eq("session_id", session.id).order("category").order("product").order("id")) : { data: [], error: null };
  if (lines.error) return { ok: false as const, error: "load" };
  return { ok: true as const, branch: branch.data!, sessions: recent.data as CountSession[], session, lines: lines.data as CountLine[] };
}

export async function editCountSession(branch: string, id: string, action: "start" | "save" | "complete" | "cancel", revision: number, lines: { id: string; quantity: number | null }[] = []) {
  if (!uuid(branch) || !uuid(id) || !["start", "save", "complete", "cancel"].includes(action) || !Number.isInteger(revision) || revision < 0
    || !Array.isArray(lines) || lines.length > 5000 || lines.some(l => !l || !uuid(l.id) || (l.quantity !== null && (typeof l.quantity !== "number" || !Number.isFinite(l.quantity) || l.quantity < 0)))
    || new Set(lines.map(l => l.id)).size !== lines.length) return { ok: false as const, error: "invalid" };
  const ctx = await scope();
  if (!ctx || ctx.branch !== branch) return { ok: false as const, error: "access" };
  const { data, error } = await ctx.db.rpc("edit_inventory_count", { p_branch: branch, p_id: id, p_action: action, p_revision: revision, p_lines: lines });
  if (error) return { ok: false as const, error: error.code === "40001" ? "conflict" : "save" };
  return { ok: true as const, id: (data as { id: string }).id };
}
