import { describe, expect, it } from "vitest";
import { isLeaderPath, isManagerPath } from "./manager-paths";

describe("manager-only paths", () => {
  it("covers manager pages but not staff pages", () => {
    for (const p of ["/staff", "/staff/123", "/analytics", "/inventory", "/inventory/purchasing", "/approvals", "/settings-hub", "/ops"]) expect(isManagerPath(p)).toBe(true);
    for (const p of ["/", "/my-day", "/schedule", "/attendance", "/checklist", "/prep", "/shift", "/shift/delivery", "/expiry", "/waste", "/temp", "/profile", "/inventory/counts", "/staffing", "/operations"]) expect(isManagerPath(p)).toBe(false);
  });
  it("covers shift-leader tools but not employee pages", () => {
    for (const p of ["/shift", "/shift/delivery", "/expiry", "/prep/plan", "/day-close", "/inventory/counts", "/inventory/counts/1"]) expect(isLeaderPath(p)).toBe(true);
    for (const p of ["/", "/my-day", "/prep", "/temp", "/waste", "/checklist", "/attendance", "/hours/record", "/profile", "/announcements", "/incidents", "/temperature", "/wastebin"]) expect(isLeaderPath(p)).toBe(false);
  });
});
