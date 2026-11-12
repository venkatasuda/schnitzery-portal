// Payroll pre-check: what would block or distort this month's payroll, found while there is still time
// to fix it (the approval gates only show counts after the month has ended). Pure.
import { isMinijob, minijobCapOn, wageIssue } from "@/lib/pay/legal";

export type PrecheckLog = { user_id: string; work_date: string; clock_in: string | null; status: string | null; approval_status: string | null; paidMin: number };
export type PrecheckStaff = { id: string; name: string; contract_type: string | null };
export type PrecheckIssue =
  | { kind: "open"; names: string[] }                       // still clocked in from an earlier day
  | { kind: "unapproved"; count: number }                   // finished shifts waiting for approval
  | { kind: "corrections"; count: number }                  // correction requests waiting
  | { kind: "noWage"; names: string[] }                     // worked this month, no hourly wage
  | { kind: "belowMin"; names: string[]; min: number }      // wage under the statutory minimum
  | { kind: "minijob"; people: { name: string; earned: number; cap: number; over: boolean }[] }; // over, or within 10 % of, the cap

export function payrollPrecheck(inp: { month: string; today: string; logs: PrecheckLog[]; staff: PrecheckStaff[]; wages: Record<string, number | null>; pendingCorrections: number }): PrecheckIssue[] {
  const out: PrecheckIssue[] = [];
  const nameOf = new Map(inp.staff.map((s) => [s.id, s.name]));
  const names = (ids: Iterable<string>) => [...new Set(ids)].map((id) => nameOf.get(id) ?? "—").sort((a, b) => a.localeCompare(b));
  const open = inp.logs.filter((l) => (l.status === "active" || l.status === "on-break") && l.work_date < inp.today);
  if (open.length) out.push({ kind: "open", names: names(open.map((l) => l.user_id)) });
  const done = inp.logs.filter((l) => l.status === "complete");
  const unapproved = done.filter((l) => l.approval_status !== "approved").length;
  if (unapproved) out.push({ kind: "unapproved", count: unapproved });
  if (inp.pendingCorrections > 0) out.push({ kind: "corrections", count: inp.pendingCorrections });
  const worked = new Set(done.map((l) => l.user_id));
  const noWage = [...worked].filter((id) => inp.wages[id] == null);
  if (noWage.length) out.push({ kind: "noWage", names: names(noWage) });
  const below = inp.staff.filter((s) => worked.has(s.id) && wageIssue(inp.wages[s.id], s.contract_type, inp.today)?.kind === "below_now");
  if (below.length) out.push({ kind: "belowMin", names: names(below.map((s) => s.id)), min: (wageIssue(inp.wages[below[0].id], below[0].contract_type, inp.today) as { min: number }).min });
  const cap = minijobCapOn(`${inp.month}-01`);
  if (cap != null) {
    const people = inp.staff.filter((s) => isMinijob(s.contract_type) && inp.wages[s.id] != null).map((s) => {
      const mins = done.filter((l) => l.user_id === s.id).reduce((n, l) => n + l.paidMin, 0);
      const earned = Math.round((mins / 60) * inp.wages[s.id]! * 100) / 100;
      return { name: s.name, earned, cap, over: earned > cap };
    }).filter((p) => p.earned >= cap * 0.9).sort((a, b) => b.earned - a.earned);
    if (people.length) out.push({ kind: "minijob", people });
  }
  return out;
}
