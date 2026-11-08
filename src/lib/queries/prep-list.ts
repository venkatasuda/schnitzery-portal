"use server";
// Daily prep list: evening leftover count → tomorrow's list → send (notifies that day's Preparation roster).
// Any active user may read their branch's sent lists; planning is checked in the database (private.can_plan_prep).
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { readAll } from "@/lib/supabase/readAll";
import { berlinToday, isCalendarDate } from "@/lib/time/berlinDate";
import { addDays, type PrepItem, type PrepLine } from "@/lib/inventory/prep-list";
import type { RecipeVersion } from "@/lib/inventory/recipes";
import type { RecipeYield } from "@/lib/inventory/preparation";

const MANAGERS = ["manager", "branch_owner", "brand_owner", "super_admin"];
const UUID = /^[0-9a-f-]{36}$/i;
const qty = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e6;
const ITEM_COLS = "id,name,name_de,unit,container_size,container_label,target_min,target_max,reserve,sort,is_active,yield_id";

async function scope() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: me } = await db.from("users").select("role,branch_id,status").eq("id", user.id).single();
  if (!me || me.status !== "active") return null;
  const branch = await activeBranchFor(db, me);
  return branch ? { db, branch, user, manager: MANAGERS.includes(me.role) } : null;
}

export type PrepListLine = PrepLine & { item_name: string; unit: string; container_size: number | null; container_label: string | null; to_prepare: number };
export type PrepListRow = { id: string; plan_date: string; status: "draft" | "sent"; version: number; note: string | null; sent_at: string | null; sent_by_name: string | null };

// One plan date: items, the leftover counted the evening before, and the saved list (if any).
export async function getPrepDay(day: string) {
  if (!isCalendarDate(day)) return { ok: false as const, error: "date" };
  const c = await scope(); if (!c) return { ok: false as const, error: "access" };
  const [branch, items, left, list, can, recipes, yields] = await Promise.all([
    c.db.from("branches").select("id,name").eq("id", c.branch).single(),
    readAll(c.db.from("prep_items").select(ITEM_COLS).eq("branch_id", c.branch).eq("is_active", true).order("sort").order("name").order("id")),
    readAll(c.db.from("prep_leftovers").select("item_id,qty,counted_at").eq("branch_id", c.branch).eq("count_date", addDays(day, -1)).order("item_id")),
    c.db.from("prep_lists").select("id,plan_date,status,version,note,sent_at,sent_by").eq("branch_id", c.branch).eq("plan_date", day).maybeSingle(),
    c.db.rpc("can_plan_prep", { p_branch: c.branch }),
    readAll(c.db.from("inventory_recipe_versions").select("id,name,portions,net_price,ingredients,created_at").eq("branch_id", c.branch).order("id")),
    readAll(c.db.from("inventory_recipe_yields").select("id,recipe_id,output_qty,output_unit,losses,confirmed,note,created_at").eq("branch_id", c.branch).order("id")),
  ]);
  if (branch.error || items.error || left.error || list.error) return { ok: false as const, error: "load" };
  let lines: PrepListLine[] = [], sentBy: string | null = null;
  if (list.data) {
    const r = await readAll(c.db.from("prep_list_lines").select("item_id,item_name,unit,container_size,container_label,target,leftover,reserve,override,reason,to_prepare,sort").eq("list_id", list.data.id).order("sort").order("item_id"));
    if (r.error) return { ok: false as const, error: "load" };
    lines = (r.data ?? []).map((l) => ({ ...l, target: Number(l.target), leftover: l.leftover == null ? null : Number(l.leftover), reserve: Number(l.reserve), override: l.override == null ? null : Number(l.override), to_prepare: Number(l.to_prepare), container_size: l.container_size == null ? null : Number(l.container_size) })) as PrepListLine[];
    if (list.data.sent_by) { const u = await c.db.from("users").select("full_name").eq("id", list.data.sent_by).maybeSingle(); sentBy = u.data?.full_name ?? null; }
  }
  const num = (a: unknown) => (Array.isArray(a) ? a.map(Number) : []);
  return {
    ok: true as const, branch: branch.data!, day, canPlan: can.data === true, isManager: c.manager,
    items: (items.data ?? []).map((i) => ({ ...i, container_size: i.container_size == null ? null : Number(i.container_size), target_min: num(i.target_min), target_max: num(i.target_max), reserve: num(i.reserve) })) as PrepItem[],
    leftovers: Object.fromEntries((left.data ?? []).map((l) => [l.item_id, Number(l.qty)])) as Record<string, number>,
    list: list.data ? { ...list.data, sent_by_name: sentBy } as PrepListRow : null, lines,
    recipes: (recipes.data ?? []) as RecipeVersion[], yields: (yields.data ?? []) as RecipeYield[],
  };
}

export async function savePrepLeftovers(branch: string, countDate: string, counts: { item_id: string; qty: number }[]) {
  if (!UUID.test(branch) || !isCalendarDate(countDate) || !Array.isArray(counts) || !counts.length || counts.length > 200
    || !counts.every((x) => UUID.test(String(x?.item_id)) && qty(x?.qty))) return { ok: false as const, error: "invalid" };
  const c = await scope(); if (!c || c.branch !== branch) return { ok: false as const, error: "access" };
  const { error } = await c.db.rpc("save_prep_leftovers", { p_branch: branch, p_date: countDate, p_counts: counts });
  return error ? { ok: false as const, error: error.code === "42501" ? "access" : "save" } : { ok: true as const };
}

export async function savePrepList(branch: string, day: string, lines: PrepLine[], note: string, send: boolean, version: number) {
  const okLine = (l: PrepLine) => UUID.test(String(l?.item_id)) && qty(l?.target) && qty(l?.reserve) && (l.leftover == null || qty(l.leftover)) && (l.override == null || qty(l.override)) && (l.reason == null || (typeof l.reason === "string" && l.reason.length <= 200));
  if (!UUID.test(branch) || !isCalendarDate(day) || !Array.isArray(lines) || !lines.length || lines.length > 200 || !lines.every(okLine)
    || typeof note !== "string" || note.length > 500 || typeof send !== "boolean" || !Number.isInteger(version)) return { ok: false as const, error: "invalid" };
  const c = await scope(); if (!c || c.branch !== branch) return { ok: false as const, error: "access" };
  const { data, error } = await c.db.rpc("save_prep_list", { p_branch: branch, p_date: day, p_lines: lines, p_note: note, p_send: send, p_version: version });
  if (error) return { ok: false as const, error: error.code === "40001" ? "conflict" : error.code === "42501" ? "access" : "save" };
  return { ok: true as const, notified: Number((data as { notified?: number })?.notified ?? 0) };
}

// Week/month analysis: per item, prepared (sent lists) vs. leftover counted the evening after.
export async function getPrepHistory(from: string, to: string) {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to || to > addDays(berlinToday(), 14)) return { ok: false as const, error: "date" };
  const c = await scope(); if (!c || !c.manager) return { ok: false as const, error: "access" };
  const lists = await readAll(c.db.from("prep_lists").select("id,plan_date").eq("branch_id", c.branch).eq("status", "sent").gte("plan_date", from).lte("plan_date", to).order("plan_date").order("id"));
  if (lists.error) return { ok: false as const, error: "load" };
  const ids = (lists.data ?? []).map((l) => l.id), dateOf = new Map((lists.data ?? []).map((l) => [l.id, l.plan_date as string]));
  const [lines, left] = await Promise.all([
    ids.length ? readAll(c.db.from("prep_list_lines").select("list_id,item_id,item_name,unit,to_prepare,override").in("list_id", ids).order("list_id").order("item_id")) : Promise.resolve({ data: [], error: null }),
    readAll(c.db.from("prep_leftovers").select("count_date,item_id,qty").eq("branch_id", c.branch).gte("count_date", from).lte("count_date", to).order("count_date").order("item_id")),
  ]);
  if (lines.error || left.error) return { ok: false as const, error: "load" };
  const leftBy = new Map((left.data ?? []).map((l) => [`${l.count_date}|${l.item_id}`, Number(l.qty)]));
  const rows = new Map<string, { item: string; unit: string; days: number; prepared: number; preparedCounted: number; leftover: number; counted: number; overridden: number }>();
  for (const l of lines.data ?? []) {
    const r = rows.get(l.item_id) ?? { item: l.item_name, unit: l.unit, days: 0, prepared: 0, preparedCounted: 0, leftover: 0, counted: 0, overridden: 0 };
    r.days++; r.prepared += Number(l.to_prepare); if (l.override != null) r.overridden++;
    const lo = leftBy.get(`${dateOf.get(l.list_id)}|${l.item_id}`); if (lo != null) { r.leftover += lo; r.counted++; r.preparedCounted += Number(l.to_prepare); }
    rows.set(l.item_id, r);
  }
  return { ok: true as const, from, to, lists: ids.length, rows: [...rows.values()].sort((a, b) => a.item.localeCompare(b.item)) };
}

// Setup (managers): items with weekday targets and the "can plan prep" switch.
export async function getPrepSetup() {
  const c = await scope(); if (!c || !c.manager) return { ok: false as const, error: "access" };
  const [items, shiftLeaders, staff, yields, recipes] = await Promise.all([
    readAll(c.db.from("prep_items").select(ITEM_COLS).eq("branch_id", c.branch).order("sort").order("name").order("id")),
    readAll(c.db.from("shift_leaders").select("user_id").eq("branch_id", c.branch).order("user_id")),
    readAll(c.db.from("users").select("id,full_name,team,role").eq("branch_id", c.branch).eq("status", "active").eq("role", "staff").order("full_name").order("id")),
    readAll(c.db.from("inventory_recipe_yields").select("id,recipe_id,output_qty,output_unit,confirmed").eq("branch_id", c.branch).eq("confirmed", true).order("id")),
    readAll(c.db.from("inventory_recipe_versions").select("id,name").eq("branch_id", c.branch).order("id")),
  ]);
  if (items.error || shiftLeaders.error || staff.error || yields.error || recipes.error) return { ok: false as const, error: "load" };
  const names = new Map((recipes.data ?? []).map((r) => [r.id, r.name as string]));
  return { ok: true as const, branch: c.branch,
    items: (items.data ?? []) as unknown as PrepItem[],
    shiftLeaders: (shiftLeaders.data ?? []).map((p) => p.user_id as string),
    staff: (staff.data ?? []) as { id: string; full_name: string | null; team: string | null }[],
    yields: (yields.data ?? []).map((y) => ({ id: y.id as string, label: `${names.get(y.recipe_id) ?? "—"} · ${Number(y.output_qty)} ${y.output_unit}` })) };
}

export type PrepItemInput = { name: string; name_de: string; unit: string; container_size: number | null; container_label: string; target_min: number[]; target_max: number[]; reserve: number[]; sort: number; yield_id: string | null };
export async function savePrepItem(id: string | null, input: PrepItemInput) {
  const c = await scope(); if (!c || !c.manager) return { ok: false as const, error: "access" };
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const week = (a: unknown) => Array.isArray(a) && a.length === 7 && a.every(qty);
  const row = { name: text(input?.name, 80), name_de: text(input?.name_de, 80) || null, unit: text(input?.unit, 20),
    container_size: input?.container_size == null ? null : Number(input.container_size), container_label: text(input?.container_label, 30) || null,
    target_min: input?.target_min, target_max: input?.target_max, reserve: input?.reserve, sort: Number.isInteger(input?.sort) ? input.sort : 0,
    yield_id: input?.yield_id && UUID.test(input.yield_id) ? input.yield_id : null };
  if (!row.name || !row.unit || !week(row.target_min) || !week(row.target_max) || !week(row.reserve)
    || row.target_min.some((v, i) => v > row.target_max[i]) || (row.container_size != null && !(row.container_size > 0 && row.container_size < 1e6))) return { ok: false as const, error: "invalid" };
  if (id != null && !UUID.test(id)) return { ok: false as const, error: "invalid" };
  const { error } = id ? await c.db.from("prep_items").update(row).eq("id", id).eq("branch_id", c.branch) : await c.db.from("prep_items").insert({ ...row, branch_id: c.branch });
  return error ? { ok: false as const, error: "save" } : { ok: true as const };
}
export async function setPrepItemActive(id: string, active: boolean) {
  const c = await scope(); if (!c || !c.manager || !UUID.test(id)) return { ok: false as const, error: "access" };
  const { error } = await c.db.from("prep_items").update({ is_active: !!active }).eq("id", id).eq("branch_id", c.branch);
  return error ? { ok: false as const, error: "save" } : { ok: true as const };
}
export async function setShiftLeader(userId: string, on: boolean) {
  const c = await scope(); if (!c || !c.manager || !UUID.test(userId)) return { ok: false as const, error: "access" };
  const { error } = on
    ? await c.db.from("shift_leaders").upsert({ branch_id: c.branch, user_id: userId, granted_by: c.user.id }, { onConflict: "branch_id,user_id", ignoreDuplicates: true })
    : await c.db.from("shift_leaders").delete().eq("branch_id", c.branch).eq("user_id", userId);
  return error ? { ok: false as const, error: "save" } : { ok: true as const };
}
