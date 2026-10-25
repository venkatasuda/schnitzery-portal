"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { getLocale } from "@/lib/i18n/server";
import { readAll } from "@/lib/supabase/readAll";
import { IMPLAUSIBLE_SHIFT_MIN } from "@/lib/pay/calculations";

// German ArbZG compliance, checked against ACTUAL clock-in/out + breaks
// (last 14 days). Flags: insufficient break on long shifts, <11h rest
// between shifts, and shifts over the 10h daily maximum. Manager-only.
// Note: restaurants are exempt from Sunday-rest rules (§10), so Sunday work
// is intentionally NOT flagged.

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: await activeBranchFor(supabase, p), homeBranchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}
function parseBreaks(raw: any): Array<{ start: string; end: string | null }> {
  if (!raw) return [];
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }
}
function breakMinutes(breaks: Array<{ start: string; end: string | null }>): number {
  let m = 0;
  for (const b of breaks) {
    if (b.start && b.end) m += (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000;
  }
  return Math.round(m);
}
// Labels and explanations follow the app language (cookie), not the server's locale.
const dlabel = (d: string, de: boolean) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString(de ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "short" });
const h1 = (mins: number) => Math.round((mins / 60) * 10) / 10;
const dn = (n: number) => n.toLocaleString("de-DE"); // 40,7 not 40.7 in German text

export async function getCompliance() {
  const { supabase, user, role, branchId } = await getMgr();
  const de = (await getLocale()) === "de";
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const since = new Date(); since.setDate(since.getDate() - 14);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: staff } = await supabase.from("users").select("id, full_name").eq("branch_id", branchId);
  const nameOf: Record<string, string> = {};
  for (const s of staff || []) nameOf[s.id] = s.full_name;

  const { data: logs, error: logsError } = await readAll(supabase
    .from("attendance_logs").select("user_id, work_date, clock_in, clock_out, breaks")
    .eq("branch_id", branchId).gte("work_date", sinceStr).eq("status", "complete").order("clock_in").order("id"));
  if (logsError) return { ok: false, error: logsError.message }; // never report "no issues" on a failed read

  const violations: { name: string; date: string; type: string; detail: string; severity: "high" | "med" }[] = [];
  const byUser: Record<string, any[]> = {};
  let checked = 0;

  for (const l of logs || []) {
    if (!l.clock_in || !l.clock_out) continue;
    checked++;
    const grossMin = (new Date(l.clock_out).getTime() - new Date(l.clock_in).getTime()) / 60000;
    const brk = breakMinutes(parseBreaks(l.breaks));
    const net = grossMin - brk;
    const name = nameOf[l.user_id] || "Unknown";
    // 16h+ = forgotten clock-out, not real work: one "check the clock-out" item, and the
    // shift stays out of the rest-time check below (its end time is wrong).
    if (grossMin > IMPLAUSIBLE_SHIFT_MIN) {
      violations.push({ name, date: dlabel(l.work_date, de), type: "Clock-out", severity: "high", detail: de ? `${dn(h1(grossMin))} Std. erfasst – Ausstempeln vergessen? Zeit korrigieren` : `${h1(grossMin)}h recorded — forgotten clock-out? Correct the time` });
      continue;
    }

    if (net > 360) {
      const required = net > 540 ? 45 : 30;
      if (brk < required) {
        violations.push({ name, date: dlabel(l.work_date, de), type: "Break", severity: "high", detail: de ? `${dn(h1(net))} Std. gearbeitet, nur ${brk} Min. Pause — nötig sind ${required} Min.` : `${h1(net)}h worked, only ${brk}min break — needs ${required}min` });
      }
    }
    if (net > 600) {
      violations.push({ name, date: dlabel(l.work_date, de), type: "Long shift", severity: "med", detail: de ? `${dn(h1(net))} Std. gearbeitet — gesetzlich max. 10 Std./Tag` : `${h1(net)}h worked — legal max is 10h/day` });
    }
    if (!byUser[l.user_id]) byUser[l.user_id] = [];
    byUser[l.user_id].push(l);
  }

  for (const uid in byUser) {
    const arr = byUser[uid].slice().sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
    for (let i = 1; i < arr.length; i++) {
      const prevOut = arr[i - 1].clock_out ? new Date(arr[i - 1].clock_out).getTime() : null;
      const nextIn = arr[i].clock_in ? new Date(arr[i].clock_in).getTime() : null;
      if (prevOut && nextIn) {
        const gapH = (nextIn - prevOut) / 3600000;
        if (gapH >= 0 && gapH < 11) {
          violations.push({ name: nameOf[uid] || "Unknown", date: dlabel(arr[i].work_date, de), type: "Rest", severity: "high", detail: de ? `Nur ${dn(Math.round(gapH * 10) / 10)} Std. Ruhezeit vor dieser Schicht — nötig sind 11 Std.` : `Only ${Math.round(gapH * 10) / 10}h rest before this shift — needs 11h` });
        }
      }
    }
  }

  const counts = {
    breakCount: violations.filter((v) => v.type === "Break").length,
    restCount: violations.filter((v) => v.type === "Rest").length,
    longCount: violations.filter((v) => v.type === "Long shift").length,
  };
  return { ok: true, violations, checked, counts };
}