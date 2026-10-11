import { describe, it, expect, afterEach, vi } from "vitest";
import { berlinToday, berlinMonth, monthRange, isCalendarDate, mondayOfDate, berlinMonday, berlinWeekdayIndex } from "./berlinDate";

it("keeps month boundaries as date-only UTC calendar dates", () => {
  expect(monthRange("2026-10")).toEqual({ ym: "2026-10", from: "2026-10-01", to: "2026-10-31", next: "2026-11-01" });
  expect(monthRange("2024-02").to).toBe("2024-02-29");
  expect(() => monthRange("2026-13")).toThrow();
  expect(isCalendarDate("2026-02-30")).toBe(false);
  expect(isCalendarDate("2024-02-29")).toBe(true);
});

describe("mondayOfDate — week starts on Monday, timezone-stable", () => {
  it("returns the same Monday for any day in that week", () => {
    expect(mondayOfDate("2026-07-06")).toBe("2026-07-06");
    expect(mondayOfDate("2026-07-08")).toBe("2026-07-06");
    expect(mondayOfDate("2026-07-12")).toBe("2026-07-06");
  });
  it("crosses month boundaries", () => {
    expect(mondayOfDate("2026-07-01")).toBe("2026-06-29");
  });
  it("crosses year boundaries", () => {
    expect(mondayOfDate("2027-01-01")).toBe("2026-12-28");
  });
  it("applies week offsets", () => {
    expect(mondayOfDate("2026-07-06", 1)).toBe("2026-07-13");
    expect(mondayOfDate("2026-07-06", -1)).toBe("2026-06-29");
    expect(mondayOfDate("2026-07-06", 4)).toBe("2026-08-03");
  });
  it("ignores a time component in the input", () => {
    expect(mondayOfDate("2026-07-12T23:59:59Z")).toBe("2026-07-06");
  });
});

describe("berlinWeekdayIndex — Monday-first index (0=Mon .. 6=Sun)", () => {
  it("maps each weekday", () => {
    expect(berlinWeekdayIndex("2026-07-06")).toBe(0);
    expect(berlinWeekdayIndex("2026-07-08")).toBe(2);
    expect(berlinWeekdayIndex("2026-07-11")).toBe(5);
    expect(berlinWeekdayIndex("2026-07-12")).toBe(6);
  });
});

describe("berlinToday — cross-midnight business-date attribution", () => {
  afterEach(() => vi.useRealTimers());
  it("attributes just-after-midnight Berlin to the new day (winter, UTC+1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T23:30:00Z"));
    expect(berlinToday()).toBe("2026-01-02");
  });
  it("attributes just-after-midnight Berlin to the new day (summer, UTC+2)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T23:30:00Z"));
    expect(berlinToday()).toBe("2026-07-02");
  });
  it("keeps a late-evening instant on the same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T21:30:00Z"));
    expect(berlinToday()).toBe("2026-07-01");
  });
  it("returns a YYYY-MM-DD shaped string", () => {
    expect(berlinToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("berlinMonth & berlinMonday", () => {
  it("berlinMonth is the year-month prefix of berlinToday", () => {
    expect(berlinMonth()).toBe(berlinToday().slice(0, 7));
  });
  it("berlinMonday returns a Monday", () => {
    expect(berlinWeekdayIndex(berlinMonday())).toBe(0);
  });
});
