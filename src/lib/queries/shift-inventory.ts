"use server";
// Shift-leader inventory (mobile "Inventory" tab). Price-free reads only; deliveries are saved without
// any cost (stripped here, refused by the database otherwise). Managers may use these too.
import { shiftScope } from "@/lib/inventory/shift-scope";
import { readAll } from "@/lib/supabase/readAll";
import { uuid, validOperation, type Product } from "@/lib/inventory/operations";

export async function getShiftAccess() {
  const c = await shiftScope();
  return c ? { ok: true as const, manager: c.manager } : { ok: false as const };
}

export async function getShiftDeliveryData() {
  const c = await shiftScope(); if (!c) return { ok: false as const, error: "access" };
  const [branch, products, suppliers] = await Promise.all([
    c.db.from("branches").select("id,name").eq("id", c.branch).single(),
    readAll(c.db.from("inventory_master").select("id,product,category,unit,is_active").eq("branch_id", c.branch).eq("is_active", true).order("category").order("product").order("id")),
    c.db.rpc("shift_supplier_names", { p_branch: c.branch }),
  ]);
  if (branch.error || products.error || suppliers.error) return { ok: false as const, error: "load" };
  const names = ((suppliers.data ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : (r as { shift_supplier_names?: string }).shift_supplier_names ?? "")).filter(Boolean);
  return { ok: true as const, branch: branch.data!,
    products: (products.data ?? []).map((p) => ({ ...p, soll: 0, reorder_point: null, reorder_qty: null, supplier_id: null, revision: 0 })) as Product[],
    suppliers: names.map((name, i) => ({ id: `s${i}`, name, is_active: true })) };
}

export async function shiftReceiveDirect(branch: string, command: string, body: unknown) {
  if (!uuid(branch) || !uuid(command) || !validOperation("receive_direct", body)) return { ok: false as const, error: "invalid" };
  const c = await shiftScope(); if (!c || c.branch !== branch) return { ok: false as const, error: "access" };
  const b = body as { lines: Record<string, unknown>[] };
  const costFree = { ...b, lines: b.lines.map((l) => ({ ...l, cost: null })) };
  const { error } = await c.db.rpc("inventory_operation", { p_branch: branch, p_command: command, p_action: "receive_direct", p_body: costFree });
  if (error) return { ok: false as const, error: ["40001", "23505"].includes(error.code) ? "conflict" : error.code === "42501" ? "access" : "save" };
  return { ok: true as const };
}
