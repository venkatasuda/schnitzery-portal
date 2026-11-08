import { describe, expect, it } from "vitest";
import { isManagerPath } from "./manager-paths";

describe("manager-only paths", () => {
  it("covers manager pages but not staff pages", () => {
    for (const p of ["/staff", "/staff/123", "/analytics", "/inventory", "/inventory/purchasing", "/approvals", "/settings-hub", "/ops"]) expect(isManagerPath(p)).toBe(true);
    for (const p of ["/", "/my-day", "/schedule", "/attendance", "/checklist", "/prep", "/shift", "/shift/delivery", "/expiry", "/waste", "/temp", "/profile", "/inventory/counts", "/staffing", "/operations"]) expect(isManagerPath(p)).toBe(false);
  });
});
