import { describe, expect, it } from "vitest";
import { weeklyTrend, forecastWeek, healthPart, healthScore, setupSteps, rosterEntryMinutes, weeklySpend, primeCost, extraHours } from "./insights";

describe("owner insights", () => {
  it("weekly trend: labour %, SPLH, and gaps stay null", () => {
    const [full, gap] = weeklyTrend(["2026-10-05", "2026-10-12"], [
      { sale_date: "2026-10-05", amount: 1000 }, { sale_date: "2026-10-06", amount: "1000" },
      { sale_date: "2026-10-12", amount: 900 },
    ], [
      { user_id: "a", work_date: "2026-10-05", paidMin: 600 }, { user_id: "a", work_date: "2026-10-06", paidMin: 600 },
      { user_id: "a", work_date: "2026-10-12", paidMin: 480 }, { user_id: "b", work_date: "2026-10-13", paidMin: 480 },
    ], { a: 15 });
    expect(full).toMatchObject({ sales: 2000, salesComplete: true, hours: 20, labourCost: 300, labourPct: 15, splh: 100 });
    // 13 Oct worked without sales; b has no wage → nothing derived is shown
    expect(gap).toMatchObject({ sales: 900, salesComplete: false, hours: 16, labourCost: null, labourPct: null, splh: null });
    // Sales without any recorded hours: attendance missing, not 0% labour.
    expect(weeklyTrend(["2026-10-19"], [{ sale_date: "2026-10-19", amount: 500 }], [], {})[0].labourPct).toBeNull();
  });

  it("forecast: same-weekday average, roster cost, missing wage hides cost", () => {
    const hist = [{ sale_date: "2026-10-12", amount: 1000 }, { sale_date: "2026-10-19", amount: 1200 }]; // Mondays
    const f = forecastWeek(["2026-10-26", "2026-10-27"], hist, [{ date: "2026-10-26", user_id: "a", mins: 480 }], { a: 15 });
    expect(f.days[0]).toEqual({ date: "2026-10-26", forecast: 1100, hours: 8, cost: 120, holiday: false });
    expect(f.days[1].forecast).toBeNull(); // no Tuesday history, but nobody planned → still complete
    expect(f).toMatchObject({ sales: 1100, cost: 120, labourPct: 10.9, missingWages: 0 });
    const g = forecastWeek(["2026-10-27"], hist, [{ date: "2026-10-27", user_id: "x", mins: 60 }], {});
    expect(g).toMatchObject({ sales: null, cost: null, labourPct: null, missingWages: 1 });
    // empty roster: whole-week expectation once every day has history
    expect(forecastWeek(["2026-10-26"], hist, [], {}).sales).toBe(1100);
  });

  it("forecast: holidays trade like Sundays and don't skew normal weekdays", () => {
    const hist = [
      { sale_date: "2026-12-11", amount: 1000 }, { sale_date: "2026-12-18", amount: 1000 }, // Fridays
      { sale_date: "2026-12-13", amount: 2000 }, { sale_date: "2026-12-20", amount: 2200 }, // Sundays
    ];
    const xmas = forecastWeek(["2026-12-25"], hist, [], {}).days[0]; // Friday, 1. Weihnachtstag
    expect(xmas).toMatchObject({ holiday: true, forecast: 2100 });
    const mondays = [{ sale_date: "2027-03-29", amount: 3000 }, { sale_date: "2027-03-23", amount: 9 }, { sale_date: "2027-04-05", amount: 1000 }]; // 29 Mar 2027 = Ostermontag
    expect(forecastWeek(["2027-04-12"], mondays, [], {}).days[0]).toMatchObject({ holiday: false, forecast: 1000 });
  });

  it("health: mean of measurable parts", () => {
    const parts = [healthPart("temps", 13, 14), healthPart("checklists", 0, 0), healthPart("sales", 6, 6), healthPart("approvals", 5, 10)];
    expect(parts.map((p) => p.score)).toEqual([93, null, 100, 50]);
    expect(healthScore(parts)).toBe(81);
    expect(healthScore([healthPart("temps", 0, 0)])).toBeNull();
  });

  it("setup: done only when the data exists; wages need every working person", () => {
    const empty = setupSteps({ staff: 4, staffWithoutWage: 4, hasTargets: false, fridges: 0, checklistTasks: 0, salesDays: 0, hasRoster: false });
    expect(empty.filter((s) => s.done).length).toBe(0);
    expect(empty[0]).toMatchObject({ key: "wages", missing: 4 });
    const ready = setupSteps({ staff: 4, staffWithoutWage: 0, hasTargets: true, fridges: 2, checklistTasks: 5, salesDays: 3, hasRoster: true });
    expect(ready.every((s) => s.done)).toBe(true);
    expect(setupSteps({ staff: 0, staffWithoutWage: 0, hasTargets: true, fridges: 1, checklistTasks: 1, salesDays: 1, hasRoster: true })[0].done).toBe(false); // no staff yet
  });

  it("roster entry minutes: preset minus break, custom range, overnight, unknown", () => {
    const times = new Map([["Kitchen|Morning", { team: "Kitchen", shift: "Morning", start: "08:00", end: "16:00", breakMins: 30 }]]);
    expect(rosterEntryMinutes({ team: "Kitchen", shift: "Morning" }, times)).toBe(450);
    expect(rosterEntryMinutes({ team: "Cashier", shift: "10:00–14:30" }, times)).toBe(270);
    expect(rosterEntryMinutes({ team: "Cashier", shift: "22:00–06:00" }, times)).toBe(480);
    expect(rosterEntryMinutes({ team: "Cashier", shift: "Evening" }, times)).toBeNull();
  });
});

describe("profit & leaks", () => {
  const weeks = ["2026-11-02", "2026-11-09"];
  it("sums purchases per week; nothing recorded is unknown, a missing cost is incomplete", () => {
    const r = weeklySpend(weeks, [{ purchase_date: "2026-11-03", cost: 100 }, { purchase_date: "2026-11-08", cost: "50.4" }, { purchase_date: "2026-11-10", cost: null }]);
    expect(r[0]).toEqual({ weekStart: "2026-11-02", spend: 150, complete: true });
    expect(r[1]).toEqual({ weekStart: "2026-11-09", spend: 0, complete: false });
    expect(weeklySpend(["2026-10-26"], [])[0].spend).toBeNull();
  });
  it("prime cost needs complete sales, labour and purchases", () => {
    const week = { weekStart: "2026-11-02", sales: 10000, salesComplete: true, hours: 100, labourCost: 3000, labourPct: 30, splh: 100 };
    expect(primeCost(week, { weekStart: "2026-11-02", spend: 2800, complete: true })).toEqual({ primePct: 58, foodPct: 28 });
    expect(primeCost({ ...week, labourCost: null }, { weekStart: "2026-11-02", spend: 2800, complete: true })).toEqual({ primePct: null, foodPct: 28 });
    expect(primeCost(week, { weekStart: "2026-11-02", spend: 2800, complete: false })).toEqual({ primePct: null, foodPct: null });
    expect(primeCost({ ...week, salesComplete: false }, { weekStart: "2026-11-02", spend: 2800, complete: true }).primePct).toBeNull();
  });
  it("counts only time beyond the roster, an unplanned day in full, and needs every wage", () => {
    const planned = [{ date: "2026-11-02", user_id: "a", mins: 420 }];
    const worked = [{ user_id: "a", work_date: "2026-11-02", paidMin: 480 }, { user_id: "b", work_date: "2026-11-03", paidMin: 120 }, { user_id: "a", work_date: "2026-11-04", paidMin: 0 }];
    expect(extraHours(planned, worked, { a: 15, b: 12 })).toEqual({ mins: 180, cost: 39 }); // 60 min × 15 + 120 min × 12
    expect(extraHours(planned, worked, { a: 15 }).cost).toBeNull();
    expect(extraHours(planned, [{ user_id: "a", work_date: "2026-11-02", paidMin: 400 }], {})).toEqual({ mins: 0, cost: 0 });
  });
});
