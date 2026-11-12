import { describe, expect, it } from "vitest";
import { isAvailDays, weekMonth, weeksOfMonth } from "./avail-weeks";

describe("availability weeks", () => {
  it("puts a week in the month of its Thursday", () => {
    expect(weekMonth("2026-11-30")).toBe("2026-12"); // 30 Nov – 6 Dec
    expect(weekMonth("2026-11-23")).toBe("2026-11");
  });
  it("lists the weeks of a month, never before the current week", () => {
    expect(weeksOfMonth("2026-12-14", "2026-11-09")).toEqual(["2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"]);
    expect(weeksOfMonth("2026-11-16", "2026-11-09")).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]); // 2 Nov is in the past
  });
  it("accepts only known days and options", () => {
    expect(isAvailDays({ Monday: ["Morning", "Dishwashing"], Sunday: [] })).toBe(true);
    expect(isAvailDays({ Monday: ["Night"] })).toBe(false);
    expect(isAvailDays({ Someday: ["Morning"] })).toBe(false);
    expect(isAvailDays(["Morning"])).toBe(false);
  });
});
