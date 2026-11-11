"use server";
// Hygiene logbook (HACCP) for a period: every temperature reading and every checklist task, per day.
// Managers only. Missing days/units are listed explicitly — an inspector must see gaps, not a silent "OK".
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { readAll } from "@/lib/supabase/readAll";
import { isCalendarDate } from "@/lib/time/berlinDate";

const MANAGERS = ["manager", "branch_owner", "brand_owner", "super_admin"];
const MAX_DAYS = 93;

export type LogbookTemp = { unit_id: string; work_date: string; temp: number; in_range: boolean; note: string | null; corrective_action: string | null; recorded_by_name: string | null; recorded_at: string };
export type LogbookTask = { work_date: string; type: string | null; task: string | null; done: boolean; value: string | null; completed_at: string | null; completed_by_name: string | null };

export async function getHygieneLog(from: string, to: string) {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return { ok: false as const, error: "date" };
  const days = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
  if (days > MAX_DAYS) return { ok: false as const, error: "range" };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "access" };
  const { data: me } = await db.from("users").select("role,branch_id").eq("id", user.id).single();
  if (!me || !MANAGERS.includes(me.role)) return { ok: false as const, error: "access" };
  const branchId = await activeBranchFor(db, me);
  if (!branchId) return { ok: false as const, error: "access" };

  const [branch, units, temps, tasks] = await Promise.all([
    db.from("branches").select("name").eq("id", branchId).single(),
    readAll(db.from("temp_units").select("id,name,kind,min_temp,max_temp,is_active,created_at").eq("branch_id", branchId).order("sort").order("name").order("id")),
    readAll(db.from("temp_logs").select("unit_id,work_date,temp,in_range,note,corrective_action,recorded_by_name,recorded_at").eq("branch_id", branchId).gte("work_date", from).lte("work_date", to).order("recorded_at").order("id")),
    readAll(db.from("checklists").select("work_date,type,task,done,value,completed_at,completed_by").eq("branch_id", branchId).gte("work_date", from).lte("work_date", to).order("work_date").order("type").order("id")),
  ]);
  if (branch.error || units.error || temps.error || tasks.error) return { ok: false as const, error: "load" };

  const ids = [...new Set((tasks.data ?? []).map((t) => t.completed_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const r = await db.from("users").select("id,full_name").in("id", ids);
    for (const u of r.data ?? []) names.set(u.id as string, (u.full_name as string) ?? "—");
  }
  // Units shown: active ones, plus inactive ones that still have readings in the period.
  const used = new Set((temps.data ?? []).map((t) => t.unit_id));
  return {
    ok: true as const, branchName: branch.data!.name as string, from, to, days,
    units: (units.data ?? []).filter((u) => u.is_active || used.has(u.id)).map((u) => ({ ...u, min_temp: Number(u.min_temp), max_temp: Number(u.max_temp),
      // First day the unit had to be checked (Berlin date it was added).
      since: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(u.created_at as string)) })) as { id: string; name: string; kind: string; min_temp: number; max_temp: number; is_active: boolean; since: string }[],
    temps: (temps.data ?? []).map((t) => ({ ...t, temp: Number(t.temp) })) as LogbookTemp[],
    tasks: (tasks.data ?? []).map((t) => ({ work_date: t.work_date, type: t.type, task: t.task, done: !!t.done, value: t.value, completed_at: t.completed_at, completed_by_name: t.completed_by ? names.get(t.completed_by) ?? "—" : null })) as LogbookTask[],
  };
}
