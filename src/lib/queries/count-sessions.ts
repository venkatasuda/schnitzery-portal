"use server";

import { inventoryKey } from "@/lib/inventory/identity";
import { shiftScope } from "@/lib/inventory/shift-scope";
import { readAll } from "@/lib/supabase/readAll";

export type CountSession = { id: string; branch_id: string; count_date: string; status: "draft" | "completed" | "cancelled"; revision: number; created_at: string; completed_at: string | null };
export type CountLine = { id: string; product: string; category: string; unit: string | null; target: number; quantity: number | null };
export type CountPack = { label: string; qty: number };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

// Managers, or active shift leaders (they may start/save/cancel; the database refuses "complete").
async function scope() {
  return shiftScope();
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
  // Only an open draft opens by itself; finished or cancelled counts open from the Recent list.
  let session = (open.data ?? null) as CountSession | null;
  if (selected) {
    const result = await ctx.db.from("inventory_count_sessions").select("*").eq("id", selected).eq("branch_id", ctx.branch).single();
    if (result.error) return { ok: false as const, error: "load" };
    session = result.data as CountSession;
  }
  const lines = session ? await readAll(ctx.db.from("inventory_count_lines").select("id,product,category,unit,target,quantity").eq("session_id", session.id).order("category").order("product").order("id")) : { data: [], error: null };
  if (lines.error) return { ok: false as const, error: "load" };
  // Pack sizes per line (e.g. "5 kg crate" = 5) for counting in packs. Only for an open draft.
  const packs: Record<string, CountPack[]> = {};
  if (session?.status === "draft" && lines.data?.length) {
    const [products, packRows] = await Promise.all([
      readAll(ctx.db.from("inventory_master").select("id,product,category,unit").eq("branch_id", ctx.branch).order("id")),
      readAll(ctx.db.from("inventory_purchase_packs").select("product_id,label,base_qty").eq("branch_id", ctx.branch).order("created_at", { ascending: false }).order("id")),
    ]);
    if (products.error || packRows.error) return { ok: false as const, error: "load" };
    const byProduct = new Map<string, CountPack[]>();
    for (const p of packRows.data ?? []) {
      const qty = Number(p.base_qty), list = byProduct.get(p.product_id) ?? [];
      if (qty > 0 && !list.some((x) => x.label === p.label)) byProduct.set(p.product_id, [...list, { label: p.label, qty }]);
    }
    const idOf = new Map((products.data ?? []).map((p) => [inventoryKey(p), p.id as string]));
    for (const line of lines.data as CountLine[]) {
      const list = byProduct.get(idOf.get(inventoryKey(line)) ?? "");
      if (list) packs[line.id] = list.slice(0, 3);
    }
  }
  return { ok: true as const, canPublish: ctx.manager, branch: branch.data!, sessions: recent.data as CountSession[], session, lines: lines.data as CountLine[], packs };
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
