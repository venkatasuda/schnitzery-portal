import { describe, expect, it } from "vitest";
import { smartSchedule, type SmartPerson } from "./smart";
import type { ShiftTime } from "@/lib/time/roster";

// Week of Mon 16 Nov 2026. Kitchen Morning 10:30–17:30 (Fri/Sat –18:30), Evening ("Night") 17:30–23:30 (Fri/Sat –02:00), Mid pending.
const times = new Map<string, ShiftTime>([
  ["Kitchen|Morning", { team: "Kitchen", shift: "Morning", start: "10:30", end: "17:30", friSatStart: "10:30", friSatEnd: "18:30" }],
  ["Kitchen|Night", { team: "Kitchen", shift: "Night", start: "17:30", end: "23:30", friSatStart: "17:30", friSatEnd: "02:00" }],
  ["Kitchen|Mid", { team: "Kitchen", shift: "Mid", start: "", end: "" }],
]);
const p = (id: string, o: Partial<SmartPerson> = {}): SmartPerson => ({ id, name: id, team: "Kitchen", contractHours: 160, tier: 2, workedH: 0, ...o });
const base = { weekStart: "2026-11-16", times, minijobbers: [], avail: {} };

describe("smart scheduler", () => {
  it("gives Friday evening to the Tier 1 who is available (+50)", () => {
    const r = smartSchedule({ ...base, staff: [p("junior", { tier: 3 }), p("ace", { tier: 1 }), p("mid")], targets: [{ weekday: 4, team: "Kitchen", shift: "Night", needed: 1 }] });
    expect(r.roster.Friday[0].user_id).toBe("ace");
  });
  it("prefers whoever is furthest behind their contract hours", () => {
    const r = smartSchedule({ ...base, staff: [p("ahead", { workedH: 150 }), p("behind", { workedH: 20 })], targets: [{ weekday: 0, team: "Kitchen", shift: "Morning", needed: 1 }] });
    expect(r.roster.Monday[0].user_id).toBe("behind");
  });
  it("blocks the next morning after a 02:00 evening (11 h rest) and leaves it open if nobody else fits", () => {
    const r = smartSchedule({ ...base, staff: [p("only")], targets: [{ weekday: 5, team: "Kitchen", shift: "Night", needed: 1 }, { weekday: 6, team: "Kitchen", shift: "Morning", needed: 1 }] });
    expect(r.roster.Saturday.map((e) => e.user_id)).toEqual(["only"]); // Sat 17:30–Sun 02:00
    expect(r.roster.Sunday).toEqual([]);                               // Sun 10:30 is only 8.5 h later
    expect(r.open).toEqual([{ day: "Sunday", team: "Kitchen", shift: "Morning", missing: 1 }]);
  });
  it("respects submitted availability, team and weekly contract hours", () => {
    const r = smartSchedule({ ...base,
      staff: [p("noMon"), p("cashier", { team: "Cashier" }), p("parttime", { contractHours: 60 })],
      avail: { noMon: { Tuesday: ["Morning"] } },
      targets: [0, 1, 2].map((d) => ({ weekday: d, team: "Kitchen", shift: "Morning", needed: 1 })) });
    expect(r.roster.Monday[0].user_id).toBe("parttime");       // noMon not available Monday, cashier wrong team
    expect(r.roster.Tuesday[0].user_id).toBe("noMon");         // submitted availability ranks first
    expect(r.roster.Wednesday).toEqual([]);                    // parttime: 60 h/month ≈ 13.8 h/week — a second 7 h shift would pass it
  });
  it("treats a pending Mid as 6 h and can fill it", () => {
    const r = smartSchedule({ ...base, staff: [p("a")], targets: [{ weekday: 0, team: "Kitchen", shift: "Mid", needed: 1 }] });
    expect(r.roster.Monday[0]).toMatchObject({ user_id: "a", shift: "Mid" });
    expect(r.hours.a).toBe(6);
  });
});
