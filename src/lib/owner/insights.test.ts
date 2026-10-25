import { describe, expect, it } from "vitest";
import { weeklyTrend, forecastWeek, healthPart, healthScore } from "./insights";

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
    expect(f.days[0]).toEqual({ date: "2026-10-26", forecast: 1100, hours: 8, cost: 120 });
    expect(f.days[1].forecast).toBeNull(); // no Tuesday history, but nobody planned → still complete
    expect(f).toMatchObject({ sales: 1100, cost: 120, labourPct: 10.9, missingWages: 0 });
    const g = forecastWeek(["2026-10-27"], hist, [{ date: "2026-10-27", user_id: "x", mins: 60 }], {});
    expect(g).toMatchObject({ sales: null, cost: null, labourPct: null, missingWages: 1 });
  });

  it("health: mean of measurable parts", () => {
    const parts = [healthPart("temps", 13, 14), healthPart("checklists", 0, 0), healthPart("sales", 6, 6), healthPart("approvals", 5, 10)];
    expect(parts.map((p) => p.score)).toEqual([93, null, 100, 50]);
    expect(healthScore(parts)).toBe(81);
    expect(healthScore([healthPart("temps", 0, 0)])).toBeNull();
  });
});
