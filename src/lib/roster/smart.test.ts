import { describe, expect, it } from "vitest";
import { smartSchedule, swapOptions, type SmartPerson, availCovers } from "./smart";
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
  it("keeps 11 h rest after last week's Sunday evening", () => {
    const targets = [{ weekday: 0, team: "Kitchen", shift: "Morning", needed: 1 }];
    const sunday = [{ user_id: "late", name: "late", team: "Kitchen", shift: "18:00–02:00" }]; // ends Monday 02:00
    expect(smartSchedule({ ...base, staff: [p("late")], targets, prevSunday: sunday }).roster.Monday).toEqual([]);
    expect(smartSchedule({ ...base, staff: [p("late")], targets }).roster.Monday.map((e) => e.user_id)).toEqual(["late"]);
  });
  it("uses a second skill only when nobody from the main team fits", () => {
    const targets = [{ weekday: 0, team: "Cashier", shift: "10:30–17:30", needed: 1 }]; // custom time: no Cashier preset in this test
    const allrounder = p("ben", { teams: ["Kitchen", "Cashier"], tier: 1, contractHours: 160 });   // Kitchen first, Cashier second
    const cashier = p("cara", { team: "Cashier", teams: ["Cashier"] });
    expect(smartSchedule({ ...base, staff: [allrounder, cashier], targets }).roster.Monday[0].user_id).toBe("cara"); // main team wins, whatever the score
    expect(smartSchedule({ ...base, staff: [allrounder], targets }).roster.Monday[0].user_id).toBe("ben");           // nobody else: skill 2 is used
    expect(smartSchedule({ ...base, staff: [p("kit")], targets }).roster.Monday).toEqual([]);                        // kitchen only: stays open
  });
  it("treats Preparation as its own availability option (Morning still counts for older entries)", () => {
    expect(availCovers({ Monday: ["Preparation"] }, "Monday", "Preparation", "Morning")).toBe(true);
    expect(availCovers({ Monday: ["Morning"], Tuesday: ["Preparation"] }, "Monday", "Preparation", "Morning")).toBe(false); // chose prep on Tuesday only
    expect(availCovers({ Monday: ["Morning"] }, "Monday", "Preparation", "Morning")).toBe(true);   // saved before the option existed
    expect(availCovers({ Monday: ["Preparation"] }, "Monday", "Kitchen", "Morning")).toBe(false);  // prep is not a kitchen morning
    expect(availCovers({ Friday: ["Evening"] }, "Friday", "Kitchen", "Night")).toBe(true);
    expect(availCovers({ Friday: ["Dishwashing"] }, "Friday", "Dishwashing", "Night")).toBe(true);                    // ticked the dishwasher box
    expect(availCovers({ Friday: ["Evening"], Saturday: ["Dishwashing"] }, "Friday", "Dishwashing", "Night")).toBe(false); // dishwashing on Saturday only
    expect(availCovers({ Friday: ["Evening"] }, "Friday", "Dishwashing", "Night")).toBe(true);                        // saved before the box existed
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
  it("swap list: green fits, amber warns (rest, tier, team), grey is unavailable or busy that day", () => {
    const K = (id: string, shift: string) => ({ user_id: id, name: id, team: "Kitchen", shift });
    const roster = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [K("holder", "Night"), K("busy", "Morning")], Saturday: [K("late", "Night")], Sunday: [] };
    const staff = [p("holder"), p("ace", { tier: 1 }), p("mid"), p("busy", { tier: 1 }), p("late", { tier: 1 }), p("cash", { team: "Cashier", tier: 1 }), p("away", { tier: 1 })];
    const avail = { ace: { Friday: ["Evening"] }, away: { Friday: ["Morning"] } };
    const fri = Object.fromEntries(swapOptions({ ...base, roster, day: "Friday", index: 0, staff, avail }).map((o) => [o.id, o]));
    expect(fri.ace).toMatchObject({ status: "ok", reasons: [] });
    expect(fri.mid).toMatchObject({ status: "warn", reasons: ["noAvail", "tier"] });
    expect(fri.cash.reasons).toContain("team");
    expect(fri.busy.status).toBe("no");                    // already on Friday Morning
    expect(fri.away).toMatchObject({ status: "no", reasons: ["unavailable"] });
    expect(fri.holder).toBeUndefined();                    // the current holder is not offered
    // "late" works Saturday 17:30–Sunday 02:00 → Sunday Morning 10:30 gets a rest warning.
    const sun = swapOptions({ ...base, roster: { ...roster, Sunday: [K("holder", "Morning")] }, day: "Sunday", index: 0, staff, avail: {} });
    expect(sun.find((o) => o.id === "late")?.reasons).toContain("rest");
  });

  it("treats a pending Mid as 6 h and can fill it", () => {
    const r = smartSchedule({ ...base, staff: [p("a")], targets: [{ weekday: 0, team: "Kitchen", shift: "Mid", needed: 1 }] });
    expect(r.roster.Monday[0]).toMatchObject({ user_id: "a", shift: "Mid" });
    expect(r.hours.a).toBe(6);
  });
});
