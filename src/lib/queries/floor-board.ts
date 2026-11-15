"use server";
// Floor board for /ops (final-plan Phase 3): today's routine work for the active branch in one read.
// Reuses the day-close snapshot (temperatures, checklists, leftovers, prep list, who is clocked in),
// plus today's prep list and deliveries expected today or overdue. Same access as the day close.
import { shiftScope } from "@/lib/inventory/shift-scope";
import { berlinToday } from "@/lib/time/berlinDate";
import type { DaySnapshot } from "@/lib/queries/day-close";

export async function getFloorBoard() {
  const c = await shiftScope(); if (!c) return { ok: false as const, error: "access" };
  const day = berlinToday();
  const [branch, snap, prep, close, orders] = await Promise.all([
    c.db.from("branches").select("id,name").eq("id", c.branch).single(),
    c.db.rpc("day_close_snapshot", { p_branch: c.branch, p_date: day }),
    c.db.from("prep_lists").select("status").eq("branch_id", c.branch).eq("plan_date", day).maybeSingle(),
    c.db.from("day_closes").select("closed_at").eq("branch_id", c.branch).eq("work_date", day).maybeSingle(),
    c.db.from("inventory_orders").select("id,supplier_name,reference,status,expected_date").eq("branch_id", c.branch)
      .in("status", ["approved", "sent", "partial"]).lte("expected_date", day).order("expected_date").limit(20),
  ]);
  if (branch.error || snap.error || prep.error || close.error || orders.error) return { ok: false as const, error: "load" };
  return {
    ok: true as const, day, branch: branch.data!, snapshot: snap.data as DaySnapshot,
    prepToday: (prep.data?.status ?? "none") as "none" | "draft" | "sent",
    closedAt: (close.data?.closed_at ?? null) as string | null,
    deliveries: (orders.data ?? []).map((o) => ({ id: o.id as string, supplier: (o.supplier_name || "—") as string, reference: o.reference as string | null, status: o.status as string, expected: o.expected_date as string, overdue: (o.expected_date as string) < day })),
  };
}
