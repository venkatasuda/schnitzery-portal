import { describe, expect, it } from "vitest";
import { checkRoster, isBlocking } from "./check";
import type { ShiftTime } from "@/lib/time/roster";

const T = (team: string, shift: string, start: string, end: string): [string, ShiftTime] =>
  [`${team}|${shift}`, { team, shift, start, end, breakMins: 0, scope: "default", friSatStart: null, friSatEnd: null } as ShiftTime];
const times = new Map([T("Kitchen", "Morning", "10:00", "16:00"), T("Kitchen", "Night", "16:00", "23:30")]);
const e = (id: string, shift: string) => ({ user_id: id, name: id.toUpperCase(), team: "Kitchen", shift });
const base = { weekStart: "2026-11-16", times, prevSunday: [], contractHours: {}, minijobbers: [] };

describe("checkRoster", () => {
  it("passes a legal week", () => {
    expect(checkRoster({ ...base, roster: { Monday: [e("a", "Night")], Tuesday: [e("a", "Night")], Thursday: [e("a", "Morning"), e("b", "Night")] } })).toEqual([]);
  });
  it("blocks under 11 h rest and overlapping shifts", () => {
    const r = checkRoster({ ...base, roster: { Monday: [e("a", "Night")], Tuesday: [e("a", "Morning")], Friday: [e("b", "Morning"), e("b", "12:00–18:00")] } });
    expect(r).toEqual([
      { kind: "rest", user_id: "a", name: "A", day: "Tuesday", value: 10.5 },   // 23:30 → 10:00
      { kind: "overlap", user_id: "b", name: "B", day: "Friday", value: 0 },
    ]);
    expect(r.every(isBlocking)).toBe(true);
  });
  it("counts rest after last week's Sunday", () => {
    const r = checkRoster({ ...base, prevSunday: [e("a", "Night")], roster: { Monday: [e("a", "Morning")] } });
    expect(r).toEqual([{ kind: "rest", user_id: "a", name: "A", day: "Monday", value: 10.5 }]);
    expect(checkRoster({ ...base, prevSunday: [e("a", "Night"), e("a", "Morning")], roster: {} })).toEqual([]); // last week alone is not judged
  });
  it("measures rest in real hours across a clock change", () => {
    // Sat 28 Mar 2026 ends 22:00 CET; Sun 29 Mar starts 09:00 CEST — 11 h on the clock, 10 h in reality.
    const t2 = new Map([T("Kitchen", "Morning", "09:00", "15:00"), T("Kitchen", "Night", "16:00", "22:00")]);
    const r = checkRoster({ ...base, weekStart: "2026-03-23", times: t2, roster: { Saturday: [e("a", "Night")], Sunday: [e("a", "Morning")] } });
    expect(r).toEqual([{ kind: "rest", user_id: "a", name: "A", day: "Sunday", value: 10 }]);
    // Autumn: 25 Oct 2026 the night is an hour longer — 22:00 → 08:00 is 11 real hours and passes.
    const t3 = new Map([T("Kitchen", "Morning", "08:00", "14:00"), T("Kitchen", "Night", "16:00", "22:00")]);
    expect(checkRoster({ ...base, weekStart: "2026-10-19", times: t3, roster: { Saturday: [e("a", "Night")], Sunday: [e("a", "Morning")] } })).toEqual([]);
  });
  it("warns above contract hours and above the Minijob cap, without blocking", () => {
    const roster = Object.fromEntries(["Monday", "Tuesday", "Wednesday", "Thursday"].map((d) => [d, [e("a", "Morning")]])); // 24 h
    const r = checkRoster({ ...base, roster, contractHours: { a: 80 },   // 80 h/month ≈ 18.5 h/week
      minijobbers: [{ id: "a", name: "A", wage: 14, workedMins: { "2026-11": 30 * 60 } }] }); // 30 h worked + 24 h planned at 14 € = 756 €
    expect(r.map((i) => i.kind)).toEqual(["hours", "minijob"]);
    expect(r[0].value).toBe(24);
    expect(r.some(isBlocking)).toBe(false);
  });
  it("skips shifts whose time is unknown", () => {
    expect(checkRoster({ ...base, roster: { Monday: [e("a", "Night")], Tuesday: [{ ...e("a", "Morning"), team: "Service" }] } })).toEqual([]);
  });
});
