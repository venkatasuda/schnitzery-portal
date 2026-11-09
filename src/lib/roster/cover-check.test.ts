import { describe, expect, it } from "vitest";
import { restIssues } from "./cover-check";

describe("restIssues", () => {
  it("flags under 11 h rest after a late shift", () => {
    expect(restIssues({ date: "2026-11-10", start: "07:00", end: "13:00" }, [{ date: "2026-11-09", start: "17:00", end: "23:00" }])).toEqual({ overlap: false, restH: 8 });
  });
  it("flags overlap on the same day and accepts enough rest", () => {
    expect(restIssues({ date: "2026-11-10", start: "12:00", end: "18:00" }, [{ date: "2026-11-10", start: "08:00", end: "14:00" }]).overlap).toBe(true);
    expect(restIssues({ date: "2026-11-11", start: "12:00", end: "18:00" }, [{ date: "2026-11-10", start: "08:00", end: "14:00" }])).toEqual({ overlap: false, restH: null });
  });
  it("handles shifts past midnight and DST end", () => {
    expect(restIssues({ date: "2026-10-25", start: "08:00", end: "14:00" }, [{ date: "2026-10-24", start: "18:00", end: "01:00" }]).restH).toBe(8); // 01:00 → 08:00 with the clock change = 8 h
  });
});
