import { describe, expect, it } from "vitest";
import { minimumWageOn, minijobCapOn, nextMinimumWage, wageIssue, isMinijob, minijobOverCap } from "./legal";

describe("German minimum wage and Minijob cap", () => {
  it("rates and caps by date", () => {
    expect(minimumWageOn("2025-06-01")).toBe(12.82);
    expect(minimumWageOn("2026-11-01")).toBe(13.9);
    expect(minimumWageOn("2027-01-01")).toBe(14.6);
    expect(minijobCapOn("2025-06-01")).toBe(556);
    expect(minijobCapOn("2026-11-01")).toBe(603);
    expect(minijobCapOn("2027-03-01")).toBe(633);
    expect(nextMinimumWage("2026-11-01")).toEqual({ from: "2027-01-01", eur: 14.6 });
  });

  it("flags wages below the minimum now, and soon", () => {
    expect(wageIssue(13.0, "Part Time", "2026-11-01")).toEqual({ kind: "below_now", min: 13.9 });
    expect(wageIssue(13.9, "Part Time", "2026-11-01")).toEqual({ kind: "below_soon", min: 14.6, from: "2027-01-01" });
    expect(wageIssue(13.9, "Part Time", "2026-09-01")).toBeNull(); // too early to warn
    expect(wageIssue(14.92, "Mini Job", "2026-11-01")).toBeNull();
    expect(wageIssue(10, "Azubi", "2026-11-01")).toBeNull(); // trainees are exempt
    expect(wageIssue(null, "Part Time", "2026-11-01")).toBeNull();
    expect(isMinijob("Mini Job")).toBe(true);
    expect(isMinijob("Full Time")).toBe(false);
  });

  it("flags a Minijobber planned over the monthly cap", () => {
    const anna = { id: "a", name: "Anna", wage: 14.92, workedMins: { "2026-11": 35 * 60 } }; // 522,20 € worked
    const ok = minijobOverCap([anna], [{ date: "2026-11-23", user_id: "a", mins: 5 * 60 }]); // +74,60 = 596,80
    expect(ok).toEqual([]);
    const over = minijobOverCap([anna], [{ date: "2026-11-23", user_id: "a", mins: 6 * 60 }]); // +89,52 = 611,72
    expect(over).toEqual([{ id: "a", name: "Anna", month: "2026-11", earnings: 611.72, cap: 603 }]);
    // shifts in the next month count towards that month only
    expect(minijobOverCap([anna], [{ date: "2026-12-01", user_id: "a", mins: 6 * 60 }])).toEqual([]);
    expect(minijobOverCap([{ ...anna, wage: null }], [{ date: "2026-11-23", user_id: "a", mins: 600 }])).toEqual([]);
  });
});
