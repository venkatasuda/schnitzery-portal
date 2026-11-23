import { describe, it, expect } from "vitest";
import { sickPay, type SickInputs } from "./sickPay";

const U = "u1", S = { otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" };
const base = (over: Partial<SickInputs> = {}): SickInputs => ({
  leave: [], start: [{ user_id: U, start_date: "2024-01-01", first_work: "2024-01-02" }],
  roster: [], times: [{ branch: null, team: "Kitchen", shift: "Early", start: "09:00", end: "17:00", friSatStart: null, friSatEnd: null, breakMins: 30 }],
  covers: [], history: [], wages: [], ...over,
});
const wages = (from: string, n: number, w = 14) => Array.from({ length: n }, (_, i) => ({ user_id: U, work_date: new Date(Date.parse(`${from}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10), hourly_wage: w }));
const leave = (from: string, to: string, extra: { eau?: boolean; note?: boolean; id?: string } = {}) => ({ id: extra.id ?? `l-${from}`, user_id: U, from, to, eau: !!extra.eau, note: !!extra.note });

describe("sickPay (EFZG)", () => {
  it("pays the rostered shift of each sick day; a day off in a rostered week is 0", () => {
    // Mon 16 + Tue 17 Nov 2026 sick; rostered Monday 09:00–17:00 with 30 min break, Tuesday off.
    const r = sickPay("2026-11", base({ leave: [leave("2026-11-16", "2026-11-17")], roster: [{ week_start: "2026-11-16", data: { Monday: [{ user_id: U, team: "Kitchen", shift: "Early" }] } }], wages: wages("2026-11-16", 2) }), S, new Set())[0];
    expect(r).toMatchObject({ days: 2, paidMin: 450, rosterDays: 2, averageDays: 0, pay: 105 });
    expect(r.flags).toEqual([]);
  });

  it("counts a shift handed to a colleague because of the sickness (approved cover)", () => {
    const r = sickPay("2026-11", base({ leave: [leave("2026-11-17", "2026-11-17")], roster: [{ week_start: "2026-11-16", data: { Monday: [] } }],
      covers: [{ user_id: U, date: "2026-11-17", team: "Kitchen", shift: "Early" }], wages: wages("2026-11-17", 1) }), S, new Set())[0];
    expect(r).toMatchObject({ days: 1, paidMin: 450, rosterDays: 1 });
  });

  it("caps a day at the overtime threshold (§ 4 Abs. 1a) and applies the legal break to custom times", () => {
    const r = sickPay("2026-11", base({ leave: [leave("2026-11-16", "2026-11-16")], roster: [{ week_start: "2026-11-16", data: { Monday: [{ user_id: U, team: "Kitchen", shift: "08:00–19:00" }] } }], wages: wages("2026-11-16", 1) }), S, new Set())[0];
    expect(r.paidMin).toBe(480); // 11 h − 45 min break = 10.25 h, capped at 8 h
  });

  it("uses the 12-month average per calendar day when there is no roster", () => {
    // 52 shifts of 7 h in the year before the sickness → 52*420/365 min per calendar day.
    const history = Array.from({ length: 52 }, (_, i) => { const d = new Date(Date.parse("2025-11-20T12:00:00Z") + i * 7 * 864e5).toISOString().slice(0, 10); return { user_id: U, work_date: d, clock_in: `${d}T08:00:00Z`, clock_out: `${d}T15:00:00Z`, duration_mins: 420, breaks: [] }; });
    const r = sickPay("2026-11", base({ leave: [leave("2026-11-16", "2026-11-18", { note: true })], history, wages: wages("2026-11-16", 3) }), S, new Set())[0];
    expect(r.averageDays).toBe(3);
    expect(r.paidMin).toBe(Math.round(3 * 52 * 420 / 365));
  });

  it("pays nothing in the first 4 weeks of employment and flags it", () => {
    const r = sickPay("2026-11", base({ start: [{ user_id: U, start_date: "2026-11-01", first_work: null }], leave: [leave("2026-11-10", "2026-11-12")],
      roster: [{ week_start: "2026-11-09", data: { Tuesday: [{ user_id: U, team: "Kitchen", shift: "Early" }] } }], wages: wages("2026-11-10", 3) }), S, new Set())[0];
    expect(r.days).toBe(0);
    expect(r.flags).toContainEqual({ kind: "waiting", until: "2026-11-28" });
  });

  it("stops after 42 calendar days and says when the health insurer takes over", () => {
    const r = sickPay("2026-11", base({ leave: [leave("2026-10-01", "2026-11-30", { eau: true })], wages: wages("2026-11-01", 30) }), S, new Set())[0];
    expect(r.days).toBe(11); // 1 Oct + 41 days = 11 Nov
    expect(r.flags).toContainEqual({ kind: "ended", on: "2026-11-11" });
  });

  it("joins back-to-back sick notes into one illness and flags a missing doctor's note after 3 days", () => {
    const r = sickPay("2026-11", base({ leave: [leave("2026-11-16", "2026-11-17", { id: "a" }), leave("2026-11-18", "2026-11-20", { id: "b" })], wages: wages("2026-11-16", 5) }), S, new Set())[0];
    expect(r.flags).toContainEqual({ kind: "eau", leaveId: "a", from: "2026-11-16", to: "2026-11-20" });
    const ok = sickPay("2026-11", base({ leave: [leave("2026-11-16", "2026-11-20", { eau: true })], wages: wages("2026-11-16", 5) }), S, new Set())[0];
    expect(ok.flags.some((f) => f.kind === "eau")).toBe(false);
  });

  it("flags a new sickness within 6 months of the last one (same illness?)", () => {
    const r = sickPay("2026-11", base({ leave: [leave("2026-08-01", "2026-08-05", { note: true }), leave("2026-11-16", "2026-11-16")], wages: wages("2026-11-16", 1) }), S, new Set())[0];
    expect(r.flags).toContainEqual({ kind: "repeat", from: "2026-11-16", lastEnd: "2026-08-05" });
  });

  it("leaves the amount empty when a wage is missing", () => {
    const r = sickPay("2026-11", base({ leave: [leave("2026-11-16", "2026-11-16")], roster: [{ week_start: "2026-11-16", data: { Monday: [{ user_id: U, team: "Kitchen", shift: "Early" }] } }] }), S, new Set())[0];
    expect(r.pay).toBeNull();
    expect(r.flags).toContainEqual({ kind: "missingWage" });
  });
});
