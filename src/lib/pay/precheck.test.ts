import { describe, expect, it } from "vitest";
import { payrollPrecheck } from "./precheck";

const staff = [
  { id: "a", name: "Anna", contract_type: "Mini Job" },
  { id: "b", name: "Ben", contract_type: "Part Time" },
  { id: "c", name: "Cem", contract_type: "Full Time" },
];
const log = (user_id: string, work_date: string, o: Partial<{ status: string; approval_status: string | null; paidMin: number }> = {}) =>
  ({ user_id, work_date, clock_in: `${work_date}T09:00:00Z`, status: "complete", approval_status: "approved", paidMin: 360, ...o });

describe("payroll pre-check", () => {
  it("is empty when everything is in order", () => {
    expect(payrollPrecheck({ month: "2026-11", today: "2026-11-20", logs: [log("b", "2026-11-03")], staff, wages: { a: 14, b: 15, c: 16 }, pendingCorrections: 0 })).toEqual([]);
  });
  it("lists open sessions, unapproved shifts, corrections, missing and too-low wages, and the Minijob cap", () => {
    const logs = [
      log("b", "2026-11-18", { status: "active" }),                    // still clocked in from the 18th
      log("b", "2026-11-20", { status: "active" }),                    // today's running shift is fine
      log("c", "2026-11-10", { approval_status: "pending" }),          // not approved, and Cem has no wage
      ...Array.from({ length: 7 }, (_, i) => log("a", `2026-11-0${i + 1}`)), // Anna: 42 h × 14 € = 588 € (cap 603 €) → near
      log("b", "2026-11-05"),
    ];
    const r = payrollPrecheck({ month: "2026-11", today: "2026-11-20", logs, staff, wages: { a: 14, b: 12, c: null }, pendingCorrections: 2 });
    expect(r).toEqual([
      { kind: "open", names: ["Ben"] },
      { kind: "unapproved", count: 1 },
      { kind: "corrections", count: 2 },
      { kind: "noWage", names: ["Cem"] },
      { kind: "belowMin", names: ["Ben"], min: 13.9 },
      { kind: "minijob", people: [{ name: "Anna", earned: 588, cap: 603, over: false }] },
    ]);
  });
});
