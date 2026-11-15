import { expect, it } from "vitest";
import { workingTimeRecord, hhmm } from "./workingTime";

it("lists shifts in Berlin time with breaks and counts only closed, real shifts", () => {
  const r = workingTimeRecord([
    { work_date: "2026-11-03", clock_in: "2026-11-03T09:00:00Z", clock_out: "2026-11-03T17:30:00Z", breaks: [{ start: "2026-11-03T12:00:00Z", end: "2026-11-03T12:30:00Z" }], status: "complete", approval_status: "approved" },
    { work_date: "2026-11-02", clock_in: "2026-11-02T16:00:00Z", clock_out: "2026-11-03T00:00:00Z", breaks: [], status: "complete", approval_status: "pending" },
    { work_date: "2026-11-04", clock_in: "2026-11-04T08:00:00Z", clock_out: "2026-11-04T08:00:00Z", status: "complete", approval_status: "pending", source: "auto_closed", duration_mins: 0 },
    { work_date: "2026-11-05", clock_in: "2026-11-05T08:00:00Z", clock_out: null, status: "active" },
  ]);
  expect(r.rows.map((x) => [x.date, x.start, x.end, x.breakMin, x.paidMin, x.state])).toEqual([
    ["2026-11-02", "17:00", "01:00", 0, 480, "pending"],
    ["2026-11-03", "10:00", "18:30", 30, 480, "approved"],
    ["2026-11-04", "09:00", "09:00", null, null, "needs_fix"],
    ["2026-11-05", "09:00", "—", null, null, "open"],
  ]);
  expect(r).toMatchObject({ totalMin: 960, approvedMin: 480, days: 2, unresolved: 2 });
  expect(hhmm(510)).toBe("8:30"); expect(hhmm(null)).toBe("—");
});
