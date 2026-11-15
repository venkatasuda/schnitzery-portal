// Working-time record (§ 16 ArbZG: employers must record working time). Pure: one row per shift from
// server-stamped attendance, Europe/Berlin times, breaks from the recorded break intervals.
// Shifts still open, or auto-closed and not yet corrected, are listed but never counted in the total.
import { shiftMinutes } from "./calculations";

export type TimeLog = { work_date: string; clock_in: string | null; clock_out: string | null; breaks?: unknown; duration_mins?: number | null;
  status?: string | null; approval_status?: string | null; source?: string | null };
export type RecordRow = { date: string; start: string; end: string; breakMin: number | null; paidMin: number | null; state: "approved" | "pending" | "open" | "needs_fix" };

const hm = (iso: string | null) => (iso ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—");

export function workingTimeRecord(logs: TimeLog[]) {
  const rows: RecordRow[] = [...logs]
    .sort((a, b) => a.work_date.localeCompare(b.work_date) || String(a.clock_in).localeCompare(String(b.clock_in)))
    .map((l) => {
      const open = !l.clock_out || l.status === "active" || l.status === "on-break";
      const needsFix = !open && l.source === "auto_closed" && l.approval_status !== "approved";
      const m = open || needsFix ? null : shiftMinutes(l);
      const state: RecordRow["state"] = open ? "open" : needsFix ? "needs_fix" : l.approval_status === "approved" ? "approved" : "pending";
      return { date: l.work_date, start: hm(l.clock_in), end: open ? "—" : hm(l.clock_out), breakMin: m?.breakMin ?? null, paidMin: m?.paidMin ?? null, state };
    });
  const counted = rows.filter((r) => r.paidMin != null);
  return {
    rows,
    totalMin: counted.reduce((a, r) => a + r.paidMin!, 0),
    approvedMin: counted.filter((r) => r.state === "approved").reduce((a, r) => a + r.paidMin!, 0),
    days: new Set(counted.map((r) => r.date)).size,
    unresolved: rows.filter((r) => r.state === "open" || r.state === "needs_fix").length,
  };
}

export const hhmm = (min: number | null) => (min == null ? "—" : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);
