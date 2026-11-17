"use server";
// End-of-day close for shift leaders and managers. The database computes the snapshot and enforces
// reasons for open points; a closed day is read-only.
import { shiftScope } from "@/lib/inventory/shift-scope";
import { isCalendarDate, addDays, berlinToday } from "@/lib/time/berlinDate";
import { channelTotal, ChannelSalesSchema, type ChannelSales } from "@/lib/sales/channels";

export type DaySnapshot = {
  date: string; recorded_sales: number | null;
  temps: { units: number; logged: number }; checklists: { total: number; done: number };
  leftovers: { items: number; counted: number }; next_prep_list: "none" | "draft" | "sent";
  clocked_in: { name: string; since: string }[]; open_points?: string[];
};
const validChannels = (c: unknown): c is ChannelSales => ChannelSalesSchema.safeParse(c).success;
export type DayCloseRow = { id: string; work_date: string; channels: ChannelSales; pos_total: number | null; pos_cash: number | null; counted_cash: number | null; cash_difference: number | null;
  snapshot: DaySnapshot; reasons: Record<string, string>; note: string | null; closed_at: string; closed_by_name: string | null };
const UUID = /^[0-9a-f-]{36}$/i;
const money = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e7);

export async function getDayClose(day: string) {
  if (!isCalendarDate(day)) return { ok: false as const, error: "date" };
  const c = await shiftScope(); if (!c) return { ok: false as const, error: "access" };
  const [branch, snap, close, recent] = await Promise.all([
    c.db.from("branches").select("id,name").eq("id", c.branch).single(),
    c.db.rpc("day_close_snapshot", { p_branch: c.branch, p_date: day }),
    c.db.from("day_closes").select("id,work_date,pos_total,pos_cash,counted_cash,cash_difference,snapshot,reasons,note,closed_at,closed_by,channels").eq("branch_id", c.branch).eq("work_date", day).maybeSingle(),
    c.db.from("day_closes").select("work_date,cash_difference,snapshot,pos_total,channels").eq("branch_id", c.branch).order("work_date", { ascending: false }).limit(14),
  ]);
  if (branch.error || snap.error || close.error || recent.error) return { ok: false as const, error: snap.error?.code === "42501" ? "access" : "load" };
  let closed: DayCloseRow | null = null;
  if (close.data) {
    const who = close.data.closed_by ? await c.db.from("users").select("full_name").eq("id", close.data.closed_by).maybeSingle() : { data: null };
    const n = (v: unknown) => (v == null ? null : Number(v));
    closed = { ...close.data, pos_total: n(close.data.pos_total), pos_cash: n(close.data.pos_cash), counted_cash: n(close.data.counted_cash), cash_difference: n(close.data.cash_difference), closed_by_name: who.data?.full_name ?? null } as DayCloseRow;
  }
  return { ok: true as const, branch: branch.data!, day, snapshot: snap.data as DaySnapshot, closed,
    recent: (recent.data ?? []).map((r) => ({ work_date: r.work_date as string, cash_difference: r.cash_difference == null ? null : Number(r.cash_difference), open: ((r.snapshot as DaySnapshot)?.open_points ?? []).length,
      till: r.pos_total == null ? null : Number(r.pos_total), delivery: channelTotal(r.channels as ChannelSales) })) };
}

export async function closeDay(branch: string, day: string, posTotal: number | null, posCash: number | null, counted: number | null, reasons: Record<string, string>, note: string, channels: ChannelSales = {}) {
  if (!validChannels(channels) || !UUID.test(branch) || !isCalendarDate(day) || ![posTotal, posCash, counted].every(money) || typeof note !== "string" || note.length > 1000
    || !reasons || typeof reasons !== "object" || Object.values(reasons).some((v) => typeof v !== "string" || v.length > 300)) return { ok: false as const, error: "invalid" };
  const c = await shiftScope(); if (!c || c.branch !== branch) return { ok: false as const, error: "access" };
  const { error } = await c.db.rpc("close_day", { p_branch: branch, p_date: day, p_pos_total: posTotal, p_pos_cash: posCash, p_counted_cash: counted, p_reasons: reasons, p_note: note, p_channels: channels });
  if (!error) return { ok: true as const };
  const missing = /Reason required for (\w+)/.exec(error.message)?.[1];
  return { ok: false as const, error: missing ? "reason" : error.code === "23505" ? "closed" : error.code === "42501" ? "access" : /exceed/.test(error.message) ? "cash" : "save", missing: missing ?? null };
}

// Sales by channel (till vs Lieferando / Uber Eats / Wolt) from the last closed days of the active branch.
export async function getChannelSales(days = 7) {
  if (!Number.isInteger(days) || days < 1 || days > 92) return { ok: false as const, error: "invalid" };
  const c = await shiftScope(); if (!c || !c.manager) return { ok: false as const, error: "access" };
  const { data, error } = await c.db.from("day_closes").select("work_date,pos_total,channels").eq("branch_id", c.branch)
    .gte("work_date", addDays(berlinToday(), -days)).order("work_date", { ascending: false });
  if (error) return { ok: false as const, error: "load" };
  return { ok: true as const, days, rows: (data ?? []).map((r) => ({ pos_total: r.pos_total == null ? null : Number(r.pos_total), channels: (r.channels ?? {}) as ChannelSales })) };
}
